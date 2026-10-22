import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { AppBom } from '../../core/boms/boms-gateway';
import { AppProduct } from '../../core/products/products-gateway';
import { AppStandardBom } from '../../core/standard-boms/standard-boms-gateway';
import { BomFormDialog, BomFormDialogData } from './bom-form-dialog';

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
    TestBed.inject(HttpTestingController).verify();
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
      const selectField = findByLabel(root, 'کد MI آنالیز استاندارد')?.closest('mat-form-field');
      expect(selectField?.textContent).toContain('کد MI آنالیز استاندارد را انتخاب کنید');
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
      expect((findByLabel(root, 'کد MI آنالیز استاندارد') as HTMLInputElement)?.value).toBe(
        `${standardBom.miCode} — ${standardBom.brand}`,
      );
    });

    it('edits the daily BOM, sending the current composition back', async () => {
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
      expect(request.request.body).toEqual({
        standardBomMiCode: '0001',
        orderNumber: 'SO-9999',
        trackingNumber: 'TN-5678',
        description: 'برای سفارش امروز',
        components: [
          { componentId: 'component-1', materials: [{ materialId: 'material-1', weight: 150 }] },
        ],
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
      const selectField = findByLabel(root, 'کد MI آنالیز استاندارد')?.closest('mat-form-field');
      expect(selectField?.textContent).toContain('آنالیز استانداردی با این کد MI یافت نشد');
    });
  });
});
