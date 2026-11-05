import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { AppBom } from '../../core/boms/boms-gateway';
import { AppProduct } from '../../core/products/products-gateway';
import { AppStandardBom } from '../../core/standard-boms/standard-boms-gateway';
import {
  CONFLICT,
  recordHasDependentsBody,
} from '../../core/http/testing/record-has-dependents-problem';
import { BomFormDialog, BomFormDialogData } from './bom-form-dialog';

const BY_NUMBER = '/api/orders/by-number/';

/** The subset of the submit pipeline a spec needs to await directly. */
interface Submittable {
  onSubmit(): Promise<unknown>;
}

/** The one selection event a spec has to drive directly: a native `mat-select` overlay doesn't open
 * in jsdom the way a click would in a real browser, so tests call the dialog's own
 * `(selectionChange)` handler exactly as the template does. */
interface Selectable {
  onStandardBomChange(miCode: string): void;
}

function setValue(element: Element | null, value: string): void {
  const input = element as HTMLInputElement;
  input.value = value;
  input.dispatchEvent(new Event('input'));
}

function findByLabel(root: HTMLElement, label: string): HTMLElement | null {
  const labels = Array.from(root.querySelectorAll('label'));
  const match = labels.find((element) => element.textContent?.trim().startsWith(label));
  const forAttr = match?.getAttribute('for');
  return forAttr ? root.querySelector(`#${forAttr}`) : null;
}

/** The form field whose `mat-label` reads `label` — how a `mat-select` is reached, since its
 * label carries no `for`. */
function fieldLabelled(root: HTMLElement, label: string): HTMLElement | null {
  return (
    Array.from(root.querySelectorAll<HTMLElement>('mat-form-field')).find(
      (field) => field.querySelector('mat-label')?.textContent?.trim() === label,
    ) ?? null
  );
}

const standardBom: AppStandardBom = {
  id: 'standard-bom-1',
  miCode: '0001',
  brand: 'Legrand',
  standardLength: 305,
  active: true,
  description: '',
  productId: 'product-1',
  components: [
    {
      id: 'component-1',
      name: 'پیچ شش‌گوش',
      materials: [
        { id: 'material-1', name: 'میلگرد فولادی', weight: 150 },
        { id: 'material-2', name: 'روکش رنگ', weight: 10 },
      ],
    },
  ],
};

const product: AppProduct = {
  id: 'product-1',
  name: 'کابل شبکه U/UTP 0.42 LEGRAND',
  components: [],
};

const otherStandardBom: AppStandardBom = {
  ...standardBom,
  id: 'standard-bom-2',
  miCode: '0002',
  productId: 'product-2',
};

const otherProduct: AppProduct = { id: 'product-2', name: 'کابل برق افشان', components: [] };

/** Every spec but the product-name ones is indifferent to the product list, so it defaults. */
type DialogDataWithoutProducts = BomFormDialogData extends infer D
  ? D extends unknown
    ? Omit<D, 'products'>
    : never
  : never;

function setUp(
  data: DialogDataWithoutProducts,
  products: readonly AppProduct[] = [product, otherProduct],
) {
  const close = vi.fn();

  TestBed.configureTestingModule({
    providers: [
      provideHttpClient(),
      provideHttpClientTesting(),
      { provide: MatDialogRef, useValue: { close } },
      { provide: MAT_DIALOG_DATA, useValue: { ...data, products } },
    ],
  });

  const fixture = TestBed.createComponent(BomFormDialog);
  const httpMock = TestBed.inject(HttpTestingController);

  return { fixture, close, httpMock, root: fixture.nativeElement as HTMLElement };
}

describe('BomFormDialog', () => {
  afterEach(() => {
    const httpMock = TestBed.inject(HttpTestingController);
    // The order lookups a spec does not assert on (an edit form looks its order up on open, a
    // typed number 400ms after typing pauses) — the ones under test are `expectOne`d.
    httpMock.match((request) => request.url.startsWith(BY_NUMBER));
    httpMock.verify();
    document.body.querySelectorAll('.cdk-overlay-container').forEach((node) => node.remove());
  });

  describe('anatomy', () => {
    it('titles a new registration and says starred fields are required', async () => {
      const { fixture, root } = setUp({ mode: 'create', standardBoms: [standardBom] });
      await fixture.whenStable();

      expect(root.querySelector('h2')?.textContent?.trim()).toBe('ثبت آنالیز روزانه جدید');
      expect(root.textContent).toContain('فیلدهای ستاره‌دار الزامی است.');
    });

    it('names its submit after the result rather than «تایید»', async () => {
      const { fixture, root } = setUp({ mode: 'create', standardBoms: [standardBom] });
      await fixture.whenStable();

      const submit = root.querySelector<HTMLButtonElement>('button[type="submit"]');
      expect(submit?.textContent?.trim()).toBe('ثبت آنالیز');
    });

    it('puts «انصراف» before the filled submit, in the footer bar', async () => {
      const { fixture, root } = setUp({ mode: 'create', standardBoms: [standardBom] });
      await fixture.whenStable();

      const footer = root.querySelector('mat-dialog-actions');
      const labels = Array.from(footer?.querySelectorAll('button') ?? []).map((b) =>
        b.textContent?.trim(),
      );
      expect(footer?.classList.contains('dialog-footer')).toBe(true);
      expect(labels).toEqual(['انصراف', 'ثبت آنالیز']);
    });
  });

  describe('product name', () => {
    function productNameField(root: HTMLElement): HTMLInputElement | null {
      return findByLabel(root, 'نام محصول') as HTMLInputElement | null;
    }

    it('shows no product name before an MI code is chosen', async () => {
      const { fixture, root } = setUp({ mode: 'create', standardBoms: [standardBom] });
      await fixture.whenStable();

      expect(productNameField(root)).toBeNull();
    });

    it('shows the chosen standard BOM’s product name, read-only, under the label «نام محصول»', async () => {
      const { fixture, root } = setUp({ mode: 'create', standardBoms: [standardBom] });
      await fixture.whenStable();

      (fixture.componentInstance as unknown as Selectable).onStandardBomChange('0001');
      await fixture.whenStable();

      const field = productNameField(root);
      expect(field?.value).toBe('کابل شبکه U/UTP 0.42 LEGRAND');
      expect(field?.readOnly).toBe(true);
    });

    it('follows the MI code when it is changed', async () => {
      const { fixture, root } = setUp({
        mode: 'create',
        standardBoms: [standardBom, otherStandardBom],
      });
      await fixture.whenStable();
      const dialog = fixture.componentInstance as unknown as Selectable;

      dialog.onStandardBomChange('0001');
      await fixture.whenStable();
      dialog.onStandardBomChange('0002');
      await fixture.whenStable();

      expect(productNameField(root)?.value).toBe('کابل برق افشان');
    });

    it('shows the product of the daily BOM’s current standard BOM in edit mode', async () => {
      const { fixture, root } = setUp({
        mode: 'edit',
        bom: {
          id: 'bom-1',
          standardBomId: 'standard-bom-2',
          orderNumber: 'SO-1234',
          trackingNumber: 'TN-5678',
          description: '',
          components: [],
        },
        standardBoms: [standardBom, otherStandardBom],
      });
      await fixture.whenStable();

      expect(productNameField(root)?.value).toBe('کابل برق افشان');
    });

    it('shows nothing when the product is not in the list it was given', async () => {
      const { fixture, root } = setUp({ mode: 'create', standardBoms: [standardBom] }, []);
      await fixture.whenStable();

      (fixture.componentInstance as unknown as Selectable).onStandardBomChange('0001');
      await fixture.whenStable();

      expect(productNameField(root)).toBeNull();
    });
  });

  describe('create mode', () => {
    it('starts with no composition until a standard BOM is chosen', async () => {
      const { fixture, root } = setUp({ mode: 'create', standardBoms: [standardBom] });
      await fixture.whenStable();

      expect(findByLabel(root, 'شماره سفارش')).not.toBeNull();
      expect(root.querySelectorAll('fieldset.component-row')).toHaveLength(0);
    });

    it('shows the chosen standard BOM’s components and materials once selected', async () => {
      const { fixture, root } = setUp({ mode: 'create', standardBoms: [standardBom] });
      await fixture.whenStable();

      const dialog = fixture.componentInstance as unknown as Selectable;
      dialog.onStandardBomChange('0001');
      await fixture.whenStable();

      const rows = root.querySelectorAll('fieldset.component-row');
      expect(rows).toHaveLength(1);
      expect(rows[0].textContent).toContain('پیچ شش‌گوش');
      expect(findByLabel(root, 'وزن «میلگرد فولادی» (گرم)')).not.toBeNull();
      expect(findByLabel(root, 'وزن «روکش رنگ» (گرم)')).not.toBeNull();
    });

    it('registers the daily BOM with a weight per material line, and closes with its new id', async () => {
      const { fixture, root, close, httpMock } = setUp({
        mode: 'create',
        standardBoms: [standardBom],
      });
      await fixture.whenStable();

      const dialog = fixture.componentInstance as unknown as Selectable;
      dialog.onStandardBomChange('0001');
      await fixture.whenStable();

      setValue(findByLabel(root, 'شماره سفارش'), 'SO-1234');
      setValue(findByLabel(root, 'شماره ردیابی'), 'TN-5678');
      setValue(findByLabel(root, 'وزن «میلگرد فولادی» (گرم)'), '150');
      setValue(findByLabel(root, 'وزن «روکش رنگ» (گرم)'), '10');
      await fixture.whenStable();

      const submittable = dialog as unknown as Submittable;
      const submitted = submittable.onSubmit();
      const request = httpMock.expectOne({ method: 'POST', url: '/api/boms' });
      expect(request.request.body).toEqual({
        standardBomMiCode: '0001',
        orderNumber: 'SO-1234',
        trackingNumber: 'TN-5678',
        description: '',
        components: [
          {
            componentId: 'component-1',
            materials: [
              { materialId: 'material-1', weight: 150 },
              { materialId: 'material-2', weight: 10 },
            ],
          },
        ],
      });
      request.flush({ id: 'registered-bom' }, { status: 201, statusText: 'Created' });
      await submitted;

      expect(close).toHaveBeenCalledWith('registered-bom');
    });

    it('accepts a fractional weight between 0 and 1', async () => {
      const { fixture, root, close, httpMock } = setUp({
        mode: 'create',
        standardBoms: [standardBom],
      });
      await fixture.whenStable();

      const dialog = fixture.componentInstance as unknown as Selectable;
      dialog.onStandardBomChange('0001');
      await fixture.whenStable();

      setValue(findByLabel(root, 'شماره سفارش'), 'SO-1234');
      setValue(findByLabel(root, 'شماره ردیابی'), 'TN-5678');
      setValue(findByLabel(root, 'وزن «میلگرد فولادی» (گرم)'), '0.1');
      setValue(findByLabel(root, 'وزن «روکش رنگ» (گرم)'), '10');
      await fixture.whenStable();

      const submitted = (dialog as unknown as Submittable).onSubmit();
      const request = httpMock.expectOne({ method: 'POST', url: '/api/boms' });
      expect(request.request.body.components[0].materials[0]).toEqual({
        materialId: 'material-1',
        weight: 0.1,
      });
      request.flush({ id: 'registered-bom' }, { status: 201, statusText: 'Created' });
      await submitted;

      expect(close).toHaveBeenCalledWith('registered-bom');
    });

    it('reports a negative material weight on that material’s field', async () => {
      const { fixture, root, close } = setUp({ mode: 'create', standardBoms: [standardBom] });
      await fixture.whenStable();

      const dialog = fixture.componentInstance as unknown as Selectable;
      dialog.onStandardBomChange('0001');
      await fixture.whenStable();

      setValue(findByLabel(root, 'شماره سفارش'), 'SO-1234');
      setValue(findByLabel(root, 'شماره ردیابی'), 'TN-5678');
      setValue(findByLabel(root, 'وزن «میلگرد فولادی» (گرم)'), '-0.1');
      setValue(findByLabel(root, 'وزن «روکش رنگ» (گرم)'), '10');

      await (dialog as unknown as Submittable).onSubmit();
      await fixture.whenStable();

      expect(close).not.toHaveBeenCalled();
      const weightField = findByLabel(root, 'وزن «میلگرد فولادی» (گرم)')?.closest('mat-form-field');
      expect(weightField?.textContent).toContain('وزن');
    });

    it('shows a root error and does not submit when no standard BOM is chosen', async () => {
      const { fixture, root, close } = setUp({ mode: 'create', standardBoms: [standardBom] });
      await fixture.whenStable();

      setValue(findByLabel(root, 'شماره سفارش'), 'SO-1234');
      setValue(findByLabel(root, 'شماره ردیابی'), 'TN-5678');

      const dialog = fixture.componentInstance as unknown as Submittable;
      await dialog.onSubmit();
      await fixture.whenStable();

      expect(close).not.toHaveBeenCalled();
      // «کد MI» is disabled with no order to offer codes from, so the refusal is the form's own.
      expect(root.querySelector('[role="alert"]')?.textContent?.trim()).toBe(
        'ابتدا شماره سفارشی تعریف‌شده را وارد کنید تا کد MI آن را انتخاب کنید.',
      );
    });

    it('reports a missing order number on that field', async () => {
      const { fixture, root, close } = setUp({ mode: 'create', standardBoms: [standardBom] });
      await fixture.whenStable();

      const dialog = fixture.componentInstance as unknown as Selectable;
      dialog.onStandardBomChange('0001');
      await fixture.whenStable();

      setValue(findByLabel(root, 'شماره ردیابی'), 'TN-5678');
      setValue(findByLabel(root, 'وزن «میلگرد فولادی» (گرم)'), '150');
      setValue(findByLabel(root, 'وزن «روکش رنگ» (گرم)'), '10');

      const submittable = dialog as unknown as Submittable;
      await submittable.onSubmit();
      await fixture.whenStable();

      expect(close).not.toHaveBeenCalled();
      const orderNumberField = findByLabel(root, 'شماره سفارش')?.closest('mat-form-field');
      expect(orderNumberField?.textContent).toContain('شماره سفارش را وارد کنید');
    });

    it('reports a missing tracking number on that field', async () => {
      const { fixture, root, close } = setUp({ mode: 'create', standardBoms: [standardBom] });
      await fixture.whenStable();

      const dialog = fixture.componentInstance as unknown as Selectable;
      dialog.onStandardBomChange('0001');
      await fixture.whenStable();

      setValue(findByLabel(root, 'شماره سفارش'), 'SO-1234');
      setValue(findByLabel(root, 'وزن «میلگرد فولادی» (گرم)'), '150');
      setValue(findByLabel(root, 'وزن «روکش رنگ» (گرم)'), '10');

      const submittable = dialog as unknown as Submittable;
      await submittable.onSubmit();
      await fixture.whenStable();

      expect(close).not.toHaveBeenCalled();
      const trackingNumberField = findByLabel(root, 'شماره ردیابی')?.closest('mat-form-field');
      expect(trackingNumberField?.textContent).toContain('شماره ردیابی را وارد کنید');
    });

    it('reports an empty material weight on that material’s field', async () => {
      const { fixture, root, close } = setUp({ mode: 'create', standardBoms: [standardBom] });
      await fixture.whenStable();

      const dialog = fixture.componentInstance as unknown as Selectable;
      dialog.onStandardBomChange('0001');
      await fixture.whenStable();

      setValue(findByLabel(root, 'شماره سفارش'), 'SO-1234');
      setValue(findByLabel(root, 'شماره ردیابی'), 'TN-5678');
      setValue(findByLabel(root, 'وزن «روکش رنگ» (گرم)'), '10');

      const submittable = dialog as unknown as Submittable;
      await submittable.onSubmit();
      await fixture.whenStable();

      expect(close).not.toHaveBeenCalled();
      const weightField = findByLabel(root, 'وزن «میلگرد فولادی» (گرم)')?.closest('mat-form-field');
      expect(weightField?.textContent).toContain('وزن');
    });

    it('reports a zero material weight on that material’s field', async () => {
      const { fixture, root, close } = setUp({ mode: 'create', standardBoms: [standardBom] });
      await fixture.whenStable();

      const dialog = fixture.componentInstance as unknown as Selectable;
      dialog.onStandardBomChange('0001');
      await fixture.whenStable();

      setValue(findByLabel(root, 'شماره سفارش'), 'SO-1234');
      setValue(findByLabel(root, 'شماره ردیابی'), 'TN-5678');
      setValue(findByLabel(root, 'وزن «میلگرد فولادی» (گرم)'), '0');
      setValue(findByLabel(root, 'وزن «روکش رنگ» (گرم)'), '10');

      const submittable = dialog as unknown as Submittable;
      await submittable.onSubmit();
      await fixture.whenStable();

      expect(close).not.toHaveBeenCalled();
      const weightField = findByLabel(root, 'وزن «میلگرد فولادی» (گرم)')?.closest('mat-form-field');
      expect(weightField?.textContent).toContain('وزن');
    });

    it('registers a daily BOM with no description', async () => {
      const { fixture, root, close, httpMock } = setUp({
        mode: 'create',
        standardBoms: [standardBom],
      });
      await fixture.whenStable();

      const dialog = fixture.componentInstance as unknown as Selectable;
      dialog.onStandardBomChange('0001');
      await fixture.whenStable();

      setValue(findByLabel(root, 'شماره سفارش'), 'SO-1234');
      setValue(findByLabel(root, 'شماره ردیابی'), 'TN-5678');
      setValue(findByLabel(root, 'وزن «میلگرد فولادی» (گرم)'), '150');
      setValue(findByLabel(root, 'وزن «روکش رنگ» (گرم)'), '10');
      await fixture.whenStable();

      const submittable = dialog as unknown as Submittable;
      const submitted = submittable.onSubmit();
      const request = httpMock.expectOne({ method: 'POST', url: '/api/boms' });
      expect(request.request.body).toMatchObject({ description: '' });
      request.flush({ id: 'registered-bom' }, { status: 201, statusText: 'Created' });
      await submitted;

      expect(close).toHaveBeenCalledWith('registered-bom');
    });
  });

  describe('edit mode', () => {
    const bom: AppBom = {
      id: 'bom-1',
      standardBomId: 'standard-bom-1',
      orderNumber: 'SO-1234',
      trackingNumber: 'TN-5678',
      description: 'برای سفارش امروز',
      components: [
        {
          id: 'component-1',
          name: 'پیچ شش‌گوش',
          materials: [{ id: 'material-1', name: 'میلگرد فولادی', weight: 150 }],
        },
      ],
    };

    it('pre-fills the form from the given daily BOM, weights included', async () => {
      const { fixture, root } = setUp({ mode: 'edit', bom, standardBoms: [standardBom] });
      await fixture.whenStable();

      expect((findByLabel(root, 'شماره سفارش') as HTMLInputElement)?.value).toBe('SO-1234');
      expect((findByLabel(root, 'شماره ردیابی') as HTMLInputElement)?.value).toBe('TN-5678');
      expect((findByLabel(root, 'وزن «میلگرد فولادی» (گرم)') as HTMLInputElement)?.value).toBe(
        '150',
      );
      expect(
        fieldLabelled(root, 'کد MI')
          ?.querySelector('.mat-mdc-select-value-text')
          ?.textContent?.trim(),
      ).toBe(`${standardBom.miCode} — ${standardBom.brand}`);
    });

    it('edits the daily BOM, sending the current composition back', async () => {
      const { fixture, root, close, httpMock } = setUp({
        mode: 'edit',
        bom,
        standardBoms: [standardBom],
      });
      await fixture.whenStable();

      setValue(findByLabel(root, 'شماره سفارش'), 'SO-9999');
      setValue(findByLabel(root, 'دلیل ویرایش'), 'خطای ترازو');
      await fixture.whenStable();

      const submittable = fixture.componentInstance as unknown as Submittable;
      const submitted = submittable.onSubmit();
      const request = httpMock.expectOne({ method: 'PATCH', url: '/api/boms/bom-1' });
      expect(request.request.body).toEqual({
        standardBomMiCode: '0001',
        orderNumber: 'SO-9999',
        trackingNumber: 'TN-5678',
        description: 'برای سفارش امروز',
        components: [
          { componentId: 'component-1', materials: [{ materialId: 'material-1', weight: 150 }] },
        ],
        editReason: 'خطای ترازو',
        editSource: 'dailyBoms',
      });
      request.flush(null, { status: 204, statusText: 'No Content' });
      await submitted;

      expect(close).toHaveBeenCalledWith('bom-1');
    });

    it('sends an explicitly cleared description, rather than omitting it', async () => {
      const { fixture, root, close, httpMock } = setUp({
        mode: 'edit',
        bom,
        standardBoms: [standardBom],
      });
      await fixture.whenStable();

      setValue(findByLabel(root, 'توضیحات'), '');
      await fixture.whenStable();

      const submittable = fixture.componentInstance as unknown as Submittable;
      const submitted = submittable.onSubmit();
      const request = httpMock.expectOne({ method: 'PATCH', url: '/api/boms/bom-1' });
      expect(request.request.body).toMatchObject({ description: '' });
      request.flush(null, { status: 204, statusText: 'No Content' });
      await submitted;

      expect(close).toHaveBeenCalledWith('bom-1');
    });

    it('says the daily BOM was re-sampled and stays open when the edit is refused', async () => {
      const { fixture, root, close, httpMock } = setUp({
        mode: 'edit',
        bom,
        standardBoms: [standardBom],
      });
      await fixture.whenStable();

      setValue(findByLabel(root, 'شماره سفارش'), 'SO-9999');
      await fixture.whenStable();

      const submitted = (fixture.componentInstance as unknown as Submittable).onSubmit();
      httpMock
        .expectOne({ method: 'PATCH', url: '/api/boms/bom-1' })
        .flush(
          recordHasDependentsBody(
            [{ kind: 'resampled-daily-bom', count: 1, names: ['SO-1'] }],
            'Bom',
          ),
          CONFLICT,
        );
      await submitted;
      await fixture.whenStable();

      expect(close).not.toHaveBeenCalled();
      expect(root.querySelector('[role="alert"]')?.textContent).toContain(
        'امکان ویرایش این اطلاعات وجود ندارد، زیرا از این آنالیز روزانه نمونه گیری مجدد شده است.',
      );
    });

    it('reports an unresolved standard BOM MI code on that field', async () => {
      const { fixture, root, close, httpMock } = setUp({
        mode: 'edit',
        bom,
        standardBoms: [standardBom],
      });
      await fixture.whenStable();

      setValue(findByLabel(root, 'شماره سفارش'), 'SO-9999');
      await fixture.whenStable();

      const submittable = fixture.componentInstance as unknown as Submittable;
      const submitted = submittable.onSubmit();
      const request = httpMock.expectOne({ method: 'PATCH', url: '/api/boms/bom-1' });
      request.flush(
        {
          type: 'https://my-api-doc.dev/problems/bom-standard-bom-not-found',
          title: 'BOM Standard BOM Not Found',
          status: 400,
          standardBomMiCode: '0001',
        },
        { status: 400, statusText: 'Bad Request' },
      );
      await submitted;
      await fixture.whenStable();

      expect(close).not.toHaveBeenCalled();
      expect(fieldLabelled(root, 'کد MI')?.textContent).toContain(
        'آنالیز استانداردی با این کد MI یافت نشد',
      );
    });

    describe('«دلیل ویرایش»', () => {
      it('asks why, in an empty textarea labelled «دلیل ویرایش»', async () => {
        const { fixture, root } = setUp({ mode: 'edit', bom, standardBoms: [standardBom] });
        await fixture.whenStable();

        const field = findByLabel(root, 'دلیل ویرایش') as HTMLTextAreaElement | null;
        expect(field?.tagName).toBe('TEXTAREA');
        expect(field?.value).toBe('');
      });

      it('saves without a reason too, leaving it to the API to judge whether anything changed', async () => {
        const { fixture, close, httpMock } = setUp({
          mode: 'edit',
          bom,
          standardBoms: [standardBom],
        });
        await fixture.whenStable();

        const submitted = (fixture.componentInstance as unknown as Submittable).onSubmit();
        const request = httpMock.expectOne({ method: 'PATCH', url: '/api/boms/bom-1' });
        expect(request.request.body).toMatchObject({ editReason: '', editSource: 'dailyBoms' });
        request.flush(null, { status: 204, statusText: 'No Content' });
        await submitted;

        expect(close).toHaveBeenCalledWith('bom-1');
      });

      it('says a reason is needed on that field, and stays open, when the API asks for one', async () => {
        const { fixture, root, close, httpMock } = setUp({
          mode: 'edit',
          bom,
          standardBoms: [standardBom],
        });
        await fixture.whenStable();

        setValue(findByLabel(root, 'شماره سفارش'), 'SO-9999');
        setValue(findByLabel(root, 'دلیل ویرایش'), '   ');
        await fixture.whenStable();

        const submitted = (fixture.componentInstance as unknown as Submittable).onSubmit();
        httpMock.expectOne({ method: 'PATCH', url: '/api/boms/bom-1' }).flush(
          {
            type: 'https://my-api-doc.dev/problems/edit-reason-required',
            title: 'Edit Reason Required',
            status: 400,
          },
          { status: 400, statusText: 'Bad Request' },
        );
        await submitted;
        await fixture.whenStable();

        expect(close).not.toHaveBeenCalled();
        const reasonField = findByLabel(root, 'دلیل ویرایش')?.closest('mat-form-field');
        expect(reasonField?.querySelector('mat-error')?.textContent?.trim()).toBe(
          'نوشتن دلیل ویرایش لازم است',
        );
      });
    });
  });

  it('asks for no edit reason while registering', async () => {
    const { fixture, root } = setUp({ mode: 'create', standardBoms: [standardBom] });
    await fixture.whenStable();

    expect(findByLabel(root, 'دلیل ویرایش')).toBeNull();
  });

  it('asks for no edit reason while re-sampling', async () => {
    const { fixture, root } = setUp({
      mode: 'resample',
      source: {
        id: 'rejected-bom',
        orderNumber: 'SO-1234',
        trackingNumber: 'TN-5678',
        standardBomMiCode: '0001',
      },
      standardBoms: [standardBom],
    });
    await fixture.whenStable();

    expect(findByLabel(root, 'دلیل ویرایش')).toBeNull();
  });

  describe('resample mode', () => {
    /** The rejected daily BOM the row offered «نمونه گیری مجدد» for. */
    const source = {
      id: 'rejected-bom',
      orderNumber: 'ORD-5002',
      trackingNumber: 'TRK-6002',
      standardBomMiCode: '0001',
    };

    function setUpResample() {
      return setUp({ mode: 'resample', source, standardBoms: [standardBom, otherStandardBom] });
    }

    function input(root: HTMLElement, label: string): HTMLInputElement {
      return findByLabel(root, label) as HTMLInputElement;
    }

    async function fillWeights(
      fixture: { whenStable(): Promise<unknown> },
      root: HTMLElement,
      first: string,
      second: string,
    ): Promise<void> {
      setValue(input(root, 'وزن «میلگرد فولادی» (گرم)'), first);
      setValue(input(root, 'وزن «روکش رنگ» (گرم)'), second);
      await fixture.whenStable();
    }

    it('titles the dialog after the daily BOM it re-samples', async () => {
      const { fixture, root } = setUpResample();
      await fixture.whenStable();

      expect(root.querySelector('h2')?.textContent?.trim()).toBe(
        'نمونه گیری مجدد آنالیز روزانه ORD-5002',
      );
    });

    it('pre-fills the order number, tracking number and MI code from the rejected daily BOM, and locks them', async () => {
      const { fixture, root } = setUpResample();
      await fixture.whenStable();

      expect(input(root, 'شماره سفارش').value).toBe('ORD-5002');
      expect(input(root, 'شماره سفارش').disabled).toBe(true);
      expect(input(root, 'شماره ردیابی').value).toBe('TRK-6002');
      expect(input(root, 'شماره ردیابی').disabled).toBe(true);
      expect(input(root, 'کد MI').value).toBe('0001');
      expect(input(root, 'کد MI').disabled).toBe(true);
    });

    it('still names the standard BOM’s product', async () => {
      const { fixture, root } = setUpResample();
      await fixture.whenStable();

      expect(input(root, 'نام محصول').value).toBe('کابل شبکه U/UTP 0.42 LEGRAND');
    });

    it('shows that standard BOM’s composition with every weight empty', async () => {
      const { fixture, root } = setUpResample();
      await fixture.whenStable();

      expect(root.querySelectorAll('fieldset.component-row')).toHaveLength(1);
      expect(input(root, 'وزن «میلگرد فولادی» (گرم)').value).toBe('');
      expect(input(root, 'وزن «روکش رنگ» (گرم)').value).toBe('');
    });

    it('has no number field but the material weights', async () => {
      const { fixture, root } = setUpResample();
      await fixture.whenStable();

      expect(root.querySelectorAll('input[type="number"]')).toHaveLength(2);
    });

    it('starts with an empty description', async () => {
      const { fixture, root } = setUpResample();
      await fixture.whenStable();

      expect((findByLabel(root, 'توضیحات') as HTMLTextAreaElement).value).toBe('');
    });

    it('keeps «ثبت آنالیز» as its submit', async () => {
      const { fixture, root } = setUpResample();
      await fixture.whenStable();

      const submit = root.querySelector<HTMLButtonElement>('button[type="submit"]');
      expect(submit?.textContent?.trim()).toBe('ثبت آنالیز');
    });

    it('re-samples with the new weights and description, and closes with the new daily BOM’s id', async () => {
      const { fixture, root, close, httpMock } = setUpResample();
      await fixture.whenStable();

      await fillWeights(fixture, root, '152', '11');
      setValue(findByLabel(root, 'توضیحات'), 'نمونه دوم');
      await fixture.whenStable();

      const submitted = (fixture.componentInstance as unknown as Submittable).onSubmit();
      const request = httpMock.expectOne({
        method: 'POST',
        url: '/api/boms/rejected-bom/resampling',
      });
      expect(request.request.body).toEqual({
        description: 'نمونه دوم',
        components: [
          {
            componentId: 'component-1',
            materials: [
              { materialId: 'material-1', weight: 152 },
              { materialId: 'material-2', weight: 11 },
            ],
          },
        ],
      });
      request.flush({ id: 'new-bom' }, { status: 201, statusText: 'Created' });
      await submitted;

      expect(close).toHaveBeenCalledWith('new-bom');
    });

    it('re-samples with no description', async () => {
      const { fixture, root, close, httpMock } = setUpResample();
      await fixture.whenStable();

      await fillWeights(fixture, root, '152', '11');

      const submitted = (fixture.componentInstance as unknown as Submittable).onSubmit();
      const request = httpMock.expectOne({
        method: 'POST',
        url: '/api/boms/rejected-bom/resampling',
      });
      expect(request.request.body).toMatchObject({ description: '' });
      request.flush({ id: 'new-bom' }, { status: 201, statusText: 'Created' });
      await submitted;

      expect(close).toHaveBeenCalledWith('new-bom');
    });

    for (const [label, weight] of [
      ['an empty', ''],
      ['a zero', '0'],
    ] as const) {
      it(`reports ${label} material weight on that material’s field and sends nothing`, async () => {
        const { fixture, root, close } = setUpResample();
        await fixture.whenStable();

        await fillWeights(fixture, root, weight, '11');

        await (fixture.componentInstance as unknown as Submittable).onSubmit();
        await fixture.whenStable();

        expect(close).not.toHaveBeenCalled();
        const weightField = findByLabel(root, 'وزن «میلگرد فولادی» (گرم)')?.closest(
          'mat-form-field',
        );
        expect(weightField?.querySelector('mat-error')?.textContent).toContain(
          'وزن مواد اولیه را به صورت عدد مثبت وارد کنید.',
        );
      });
    }

    it('shows a weight the server refuses as a form error', async () => {
      const { fixture, root, close, httpMock } = setUpResample();
      await fixture.whenStable();

      await fillWeights(fixture, root, '152', '11');

      const submitted = (fixture.componentInstance as unknown as Submittable).onSubmit();
      httpMock.expectOne({ method: 'POST', url: '/api/boms/rejected-bom/resampling' }).flush(
        {
          type: 'https://my-api-doc.dev/problems/validation-error',
          title: 'Validation Error',
          status: 400,
          errors: [{ field: 'weight', message: 'weight must be a positive number' }],
        },
        { status: 400, statusText: 'Bad Request' },
      );
      await submitted;
      await fixture.whenStable();

      expect(close).not.toHaveBeenCalled();
      expect(root.querySelector('[role="alert"]')?.textContent).toContain(
        'وزن مواد اولیه را به صورت عدد مثبت وارد کنید.',
      );
    });

    it('says so when the daily BOM can no longer be re-sampled', async () => {
      const { fixture, root, close, httpMock } = setUpResample();
      await fixture.whenStable();

      await fillWeights(fixture, root, '152', '11');

      const submitted = (fixture.componentInstance as unknown as Submittable).onSubmit();
      httpMock.expectOne({ method: 'POST', url: '/api/boms/rejected-bom/resampling' }).flush(
        {
          type: 'https://my-api-doc.dev/problems/bom-not-resamplable',
          title: 'BOM Not Resamplable',
          status: 409,
        },
        { status: 409, statusText: 'Conflict' },
      );
      await submitted;
      await fixture.whenStable();

      expect(close).not.toHaveBeenCalled();
      expect(root.querySelector('[role="alert"]')?.textContent).toContain(
        'از این آنالیز روزانه دیگر نمی‌توان نمونه گیری مجدد کرد',
      );
    });
  });

  // Issue #101: a daily BOM is registered for a defined order, with one of that order's MI codes.
  describe('the order', () => {
    /** «0003», a second MI code of the first standard BOM's product, sharing one material. */
    const sameProductStandardBom: AppStandardBom = {
      ...standardBom,
      id: 'standard-bom-3',
      miCode: '0003',
      brand: 'Kablan',
      components: [
        {
          id: 'component-1',
          name: 'پیچ شش‌گوش',
          materials: [
            { id: 'material-1', name: 'میلگرد فولادی', weight: 150 },
            { id: 'material-3', name: 'نوار مسی', weight: 20 },
          ],
        },
      ],
    };
    const STANDARD_BOMS = [standardBom, otherStandardBom, sameProductStandardBom];

    const code = (miCode: string, productId: string, standardBomId: string) => ({
      standardBomId,
      miCode,
      productId,
      productName: productId === 'product-1' ? 'کابل شبکه' : 'کابل برق',
    });
    const oneCodeOrder = {
      id: 'order-1',
      orderNumber: 'ORD-5001',
      miCodes: [code('0001', 'product-1', 'standard-bom-1')],
      dailyBomCount: 0,
    };
    const threeCodeOrder = {
      id: 'order-2',
      orderNumber: 'ORD-5002',
      miCodes: [
        code('0001', 'product-1', 'standard-bom-1'),
        code('0002', 'product-2', 'standard-bom-2'),
        code('0003', 'product-1', 'standard-bom-3'),
      ],
      dailyBomCount: 1,
    };

    type Context = ReturnType<typeof setUp>;
    type Fixture = Context['fixture'];

    async function typeOrderNumber(fixture: Fixture, value: string, blur = true) {
      const field = findByLabel(fixture.nativeElement, 'شماره سفارش') as HTMLInputElement;
      setValue(field, value);
      if (blur) {
        field.dispatchEvent(new Event('blur'));
      }
      await fixture.whenStable();
    }

    async function answerLookup(context: Context, orderNumber: string, order: object | null) {
      const request = await vi.waitFor(() =>
        context.httpMock.expectOne({ method: 'GET', url: BY_NUMBER + orderNumber }),
      );
      if (order === null) {
        request.flush(
          { type: 'https://my-api-doc.dev/problems/entity-not-found', status: 404 },
          { status: 404, statusText: 'Not Found' },
        );
      } else {
        request.flush(order);
      }
      await context.fixture.whenStable();
    }

    function miCodeField(root: HTMLElement): HTMLElement {
      return fieldLabelled(root, 'کد MI') as HTMLElement;
    }

    /** What the combobox reports to assistive tech and the acceptance suite. */
    const miCodeDisabled = (root: HTMLElement) =>
      miCodeField(root).querySelector('mat-select')?.getAttribute('aria-disabled') === 'true';

    const shownMiCode = (root: HTMLElement) =>
      miCodeField(root).querySelector('.mat-mdc-select-value-text')?.textContent?.trim() ?? '';

    async function offeredMiCodes(fixture: Fixture): Promise<string[]> {
      miCodeField(fixture.nativeElement)
        .querySelector<HTMLElement>('.mat-mdc-select-trigger')
        ?.click();
      await fixture.whenStable();
      return Array.from(document.body.querySelectorAll('mat-option')).map(
        (option) => option.textContent?.trim() ?? '',
      );
    }

    async function chooseMiCode(fixture: Fixture, miCode: string) {
      await offeredMiCodes(fixture);
      Array.from(document.body.querySelectorAll<HTMLElement>('mat-option'))
        .find((option) => option.textContent?.includes(miCode))
        ?.click();
      await fixture.whenStable();
    }

    describe('while registering', () => {
      const create = () => setUp({ mode: 'create', standardBoms: STANDARD_BOMS });

      it('asks for the order number before the MI code', async () => {
        const { fixture, root } = create();
        await fixture.whenStable();

        const labels = Array.from(root.querySelectorAll('mat-label')).map((label) =>
          label.textContent?.trim(),
        );
        expect(labels.indexOf('شماره سفارش')).toBeLessThan(labels.indexOf('کد MI'));
      });

      it('looks the order up once the number field is left, its digits made Latin', async () => {
        const context = create();
        await context.fixture.whenStable();

        await typeOrderNumber(context.fixture, ' ORD-۵۰۰۱ ');

        await answerLookup(context, 'ORD-5001', oneCodeOrder);
      });

      it('looks the order up by itself once typing pauses', async () => {
        const context = create();
        await context.fixture.whenStable();

        await typeOrderNumber(context.fixture, 'ORD-5001', false);
        context.httpMock.expectNone({ method: 'GET', url: BY_NUMBER + 'ORD-5001' });

        await answerLookup(context, 'ORD-5001', oneCodeOrder);
      });

      // A `mat-select` with no options never opens its panel, so a click that lands before the
      // lookup answers would be lost: the select is disabled until it has codes to offer.
      it('keeps «کد MI» disabled until the order lookup answers with codes', async () => {
        const context = create();
        await context.fixture.whenStable();
        expect(miCodeDisabled(context.root)).toBe(true);

        await typeOrderNumber(context.fixture, 'ORD-6001');
        expect(miCodeDisabled(context.root)).toBe(true);
        await answerLookup(context, 'ORD-6001', null);
        expect(miCodeDisabled(context.root)).toBe(true);

        await typeOrderNumber(context.fixture, 'ORD-5002');
        await answerLookup(context, 'ORD-5002', threeCodeOrder);
        expect(miCodeDisabled(context.root)).toBe(false);
      });

      it('still refuses to register without an MI code while «کد MI» is disabled', async () => {
        const context = create();
        await context.fixture.whenStable();
        setValue(findByLabel(context.root, 'شماره ردیابی'), 'TN-1');
        await typeOrderNumber(context.fixture, 'ORD-6001');

        await (context.fixture.componentInstance as unknown as Submittable).onSubmit();
        await context.fixture.whenStable();

        context.httpMock.expectNone({ method: 'POST', url: '/api/boms' });
        expect(context.close).not.toHaveBeenCalled();
      });

      it('chooses the only MI code of the order and shows its composition', async () => {
        const context = create();
        await context.fixture.whenStable();

        await typeOrderNumber(context.fixture, 'ORD-5001');
        await answerLookup(context, 'ORD-5001', oneCodeOrder);

        expect(shownMiCode(context.root)).toBe('0001 — Legrand');
        expect(findByLabel(context.root, 'وزن «میلگرد فولادی» (گرم)')).not.toBeNull();
      });

      it('offers only the order’s MI codes', async () => {
        const context = create();
        await context.fixture.whenStable();

        await typeOrderNumber(context.fixture, 'ORD-5002');
        await answerLookup(context, 'ORD-5002', threeCodeOrder);

        expect(await offeredMiCodes(context.fixture)).toEqual([
          '0001 — Legrand',
          '0002 — Legrand',
          '0003 — Kablan',
        ]);
      });

      it('chooses none of several, and refuses to register until one is chosen', async () => {
        const context = create();
        await context.fixture.whenStable();

        await typeOrderNumber(context.fixture, 'ORD-5002');
        await answerLookup(context, 'ORD-5002', threeCodeOrder);
        setValue(findByLabel(context.root, 'شماره ردیابی'), 'TN-1');
        await (context.fixture.componentInstance as unknown as Submittable).onSubmit();
        await context.fixture.whenStable();

        expect(shownMiCode(context.root)).toBe('');
        expect(miCodeField(context.root).querySelector('mat-error')?.textContent?.trim()).toBe(
          'کد MI را انتخاب کنید.',
        );
        expect(context.close).not.toHaveBeenCalled();
      });

      it('registers with the MI code chosen from the order', async () => {
        const context = create();
        await context.fixture.whenStable();

        await typeOrderNumber(context.fixture, 'ORD-5002');
        await answerLookup(context, 'ORD-5002', threeCodeOrder);
        await chooseMiCode(context.fixture, '0003');
        setValue(findByLabel(context.root, 'شماره ردیابی'), 'TN-1');
        setValue(findByLabel(context.root, 'وزن «میلگرد فولادی» (گرم)'), '150');
        setValue(findByLabel(context.root, 'وزن «نوار مسی» (گرم)'), '20');
        await context.fixture.whenStable();

        const submitted = (context.fixture.componentInstance as unknown as Submittable).onSubmit();
        const request = context.httpMock.expectOne({ method: 'POST', url: '/api/boms' });
        expect(request.request.body).toMatchObject({
          standardBomMiCode: '0003',
          orderNumber: 'ORD-5002',
        });
        request.flush({ id: 'new-bom' }, { status: 201, statusText: 'Created' });
        await submitted;

        expect(context.close).toHaveBeenCalledWith('new-bom');
      });

      it('says in the form that an order is not defined, and clears the MI code', async () => {
        const context = create();
        await context.fixture.whenStable();

        await typeOrderNumber(context.fixture, 'ORD-5001');
        await answerLookup(context, 'ORD-5001', oneCodeOrder);
        await typeOrderNumber(context.fixture, 'ORD-6001');
        await answerLookup(context, 'ORD-6001', null);

        expect(context.root.querySelector('[role="alert"]')?.textContent?.trim()).toBe(
          'سفارشی با شماره «ORD-6001» تعریف نشده است. ابتدا آن را در صفحهٔ سفارشات تعریف کنید.',
        );
        expect(shownMiCode(context.root)).toBe('');
        expect(context.root.querySelectorAll('fieldset.component-row')).toHaveLength(0);
      });
    });

    describe('while editing', () => {
      const bom: AppBom = {
        id: 'bom-1',
        standardBomId: 'standard-bom-1',
        orderNumber: 'ORD-5002',
        trackingNumber: 'TN-1',
        description: '',
        components: [
          {
            id: 'component-1',
            name: 'پیچ شش‌گوش',
            materials: [
              { id: 'material-1', name: 'میلگرد فولادی', weight: 140 },
              { id: 'material-2', name: 'روکش رنگ', weight: 12 },
            ],
          },
        ],
      };
      const edit = () => setUp({ mode: 'edit', bom, standardBoms: STANDARD_BOMS });

      it('keeps «کد MI» enabled before the lookup answers — the current code is listed', async () => {
        const context = edit();
        await context.fixture.whenStable();

        expect(miCodeDisabled(context.root)).toBe(false);
        await answerLookup(context, 'ORD-5002', threeCodeOrder);
      });

      it('looks its order up as it opens, and offers the order’s codes of the same product', async () => {
        const context = edit();
        await context.fixture.whenStable();
        await answerLookup(context, 'ORD-5002', threeCodeOrder);

        expect(shownMiCode(context.root)).toBe('0001 — Legrand');
        expect(await offeredMiCodes(context.fixture)).toEqual(['0001 — Legrand', '0003 — Kablan']);
      });

      it('reloads the composition for another MI code, keeping the weights of the same lines', async () => {
        const context = edit();
        await context.fixture.whenStable();
        await answerLookup(context, 'ORD-5002', threeCodeOrder);

        await chooseMiCode(context.fixture, '0003');

        const kept = findByLabel(context.root, 'وزن «میلگرد فولادی» (گرم)') as HTMLInputElement;
        expect(kept.value).toBe('140');
        expect(findByLabel(context.root, 'وزن «روکش رنگ» (گرم)')).toBeNull();
        expect(findByLabel(context.root, 'وزن «نوار مسی» (گرم)')).not.toBeNull();
      });

      it('sends the new MI code with the reloaded composition', async () => {
        const context = edit();
        await context.fixture.whenStable();
        await answerLookup(context, 'ORD-5002', threeCodeOrder);
        await chooseMiCode(context.fixture, '0003');
        setValue(findByLabel(context.root, 'وزن «نوار مسی» (گرم)'), '25');
        await context.fixture.whenStable();

        const submitted = (context.fixture.componentInstance as unknown as Submittable).onSubmit();
        const request = context.httpMock.expectOne({ method: 'PATCH', url: '/api/boms/bom-1' });
        expect(request.request.body).toMatchObject({
          standardBomMiCode: '0003',
          components: [
            {
              componentId: 'component-1',
              materials: [
                { materialId: 'material-1', weight: 140 },
                { materialId: 'material-3', weight: 25 },
              ],
            },
          ],
        });
        request.flush(null, { status: 204, statusText: 'No Content' });
        await submitted;
      });

      it('looks a changed order number up again, keeping the MI code', async () => {
        const context = edit();
        await context.fixture.whenStable();
        await answerLookup(context, 'ORD-5002', threeCodeOrder);

        await typeOrderNumber(context.fixture, 'ORD-5001');
        await answerLookup(context, 'ORD-5001', oneCodeOrder);

        expect(shownMiCode(context.root)).toBe('0001 — Legrand');
      });
    });

    it('looks nothing up while re-sampling — the order is the rejected daily BOM’s', async () => {
      const context = setUp({
        mode: 'resample',
        source: {
          id: 'rejected-bom',
          orderNumber: 'ORD-5002',
          trackingNumber: 'TN-1',
          standardBomMiCode: '0001',
        },
        standardBoms: STANDARD_BOMS,
      });
      await context.fixture.whenStable();
      await new Promise((resolve) => setTimeout(resolve, 450));

      context.httpMock.expectNone((request) => request.url.startsWith(BY_NUMBER));
    });

    describe('the API’s refusals', () => {
      async function refuse(type: string) {
        const context = setUp({ mode: 'create', standardBoms: STANDARD_BOMS });
        await context.fixture.whenStable();
        // As the visitor gets there: the order looked up, one of its codes chosen.
        await typeOrderNumber(context.fixture, 'ORD-5002');
        await answerLookup(context, 'ORD-5002', threeCodeOrder);
        await chooseMiCode(context.fixture, '0001');
        setValue(findByLabel(context.root, 'شماره ردیابی'), 'TN-1');
        await context.fixture.whenStable();
        setValue(findByLabel(context.root, 'وزن «میلگرد فولادی» (گرم)'), '150');
        setValue(findByLabel(context.root, 'وزن «روکش رنگ» (گرم)'), '10');
        await context.fixture.whenStable();
        const submitted = (context.fixture.componentInstance as unknown as Submittable).onSubmit();
        context.httpMock
          .expectOne({ method: 'POST', url: '/api/boms' })
          .flush({ type, status: 400 }, { status: 400, statusText: 'Bad Request' });
        await submitted;
        await context.fixture.whenStable();
        return context;
      }

      const errorOn = (root: HTMLElement, label: string) =>
        fieldLabelled(root, label)?.querySelector('mat-error')?.textContent?.trim();

      it('says an undefined order on the order number', async () => {
        const { root } = await refuse('https://my-api-doc.dev/problems/bom-order-not-defined');
        expect(errorOn(root, 'شماره سفارش')).toBe('سفارشی با این شماره تعریف نشده است.');
      });

      it('asks for the MI code of an order with several', async () => {
        const { root } = await refuse('https://my-api-doc.dev/problems/bom-mi-code-required');
        expect(errorOn(root, 'کد MI')).toBe('این سفارش چند کد MI دارد؛ کد MI را انتخاب کنید.');
      });

      it('says an MI code is not the order’s', async () => {
        const { root } = await refuse('https://my-api-doc.dev/problems/bom-mi-code-not-in-order');
        expect(errorOn(root, 'کد MI')).toBe(
          'این کد MI به این سفارش تخصیص داده نشده یا از محصول دیگری است.',
        );
      });
    });
  });
});
