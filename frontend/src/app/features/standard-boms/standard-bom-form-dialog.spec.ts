import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { AppProduct } from '../../core/products/products-gateway';
import { AppStandardBom } from '../../core/standard-boms/standard-boms-gateway';
import { StandardBomFormDialog, StandardBomFormDialogData } from './standard-bom-form-dialog';

/** The subset of the submit pipeline a spec needs to await directly. */
interface Submittable {
  onSubmit(): Promise<unknown>;
}

/**
 * The two selection events a spec has to drive directly: neither a native `mat-select` overlay nor
 * a CDK-driven radio group opens in jsdom the way a click would in a real browser, so tests call the
 * dialog's own `(selectionChange)` handlers exactly as the template does.
 */
interface Selectable {
  onProductChange(productId: string): void;
  onActiveChange(value: '' | 'true' | 'false'): void;
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

/** `mat-select` associates its label through `aria-labelledby`, not `for` — unlike `matInput`, so
 * `findByLabel` above cannot locate it. */
function findSelectByLabel(root: HTMLElement, label: string): HTMLElement | null {
  const select = Array.from(root.querySelectorAll<HTMLElement>('mat-select')).find((element) => {
    const labelledBy = element.getAttribute('aria-labelledby');
    const labelElement = labelledBy ? root.querySelector(`#${labelledBy}`) : null;
    return labelElement?.textContent?.trim().startsWith(label) ?? false;
  });
  return select ?? null;
}

const product: AppProduct = {
  id: 'product-1',
  name: 'کابل شبکه U/UTP 0.42 LEGRAND',
  components: [
    {
      id: 'component-1',
      name: 'پیچ شش‌گوش',
      materials: [
        { id: 'material-1', name: 'میلگرد فولادی' },
        { id: 'material-2', name: 'روکش رنگ' },
      ],
    },
  ],
};

function setUp(data: StandardBomFormDialogData) {
  const close = vi.fn();

  TestBed.configureTestingModule({
    providers: [
      provideHttpClient(),
      provideHttpClientTesting(),
      { provide: MatDialogRef, useValue: { close } },
      { provide: MAT_DIALOG_DATA, useValue: data },
    ],
  });

  const fixture = TestBed.createComponent(StandardBomFormDialog);
  const httpMock = TestBed.inject(HttpTestingController);

  return { fixture, close, httpMock, root: fixture.nativeElement as HTMLElement };
}

describe('StandardBomFormDialog', () => {
  afterEach(() => {
    TestBed.inject(HttpTestingController).verify();
  });

  describe('create mode', () => {
    it('starts with no composition until a product is chosen', async () => {
      const { fixture, root } = setUp({ mode: 'create', products: [product] });
      await fixture.whenStable();

      expect(findByLabel(root, 'کد MI')).not.toBeNull();
      expect(root.querySelectorAll('fieldset.component-row')).toHaveLength(0);
    });

    it('shows the chosen product’s components and materials once selected', async () => {
      const { fixture, root } = setUp({ mode: 'create', products: [product] });
      await fixture.whenStable();

      const dialog = fixture.componentInstance as unknown as Selectable;
      dialog.onProductChange('product-1');
      await fixture.whenStable();

      const rows = root.querySelectorAll('fieldset.component-row');
      expect(rows).toHaveLength(1);
      expect(rows[0].textContent).toContain('پیچ شش‌گوش');
      expect(findByLabel(root, 'وزن استاندارد «میلگرد فولادی» (گرم)')).not.toBeNull();
      expect(findByLabel(root, 'وزن استاندارد «روکش رنگ» (گرم)')).not.toBeNull();
    });

    it('registers the standard BOM with a weight per material line, and closes on success', async () => {
      const { fixture, root, close, httpMock } = setUp({ mode: 'create', products: [product] });
      await fixture.whenStable();

      const dialog = fixture.componentInstance as unknown as Selectable;
      dialog.onProductChange('product-1');
      await fixture.whenStable();

      setValue(findByLabel(root, 'کد MI'), '1234');
      setValue(findByLabel(root, 'برند'), 'Legrand');
      setValue(findByLabel(root, 'متراژ استاندارد'), '305');
      setValue(findByLabel(root, 'وزن استاندارد «میلگرد فولادی» (گرم)'), '150');
      setValue(findByLabel(root, 'وزن استاندارد «روکش رنگ» (گرم)'), '10');
      dialog.onActiveChange('true');
      await fixture.whenStable();

      const submittable = dialog as unknown as Submittable;
      const submitted = submittable.onSubmit();
      const request = httpMock.expectOne({ method: 'POST', url: '/api/standard-boms' });
      expect(request.request.body).toEqual({
        productId: 'product-1',
        miCode: '1234',
        brand: 'Legrand',
        standardLength: 305,
        active: true,
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
      request.flush({ id: '1' }, { status: 201, statusText: 'Created' });
      await submitted;

      expect(close).toHaveBeenCalledWith(true);
    });

    it('shows a root error and does not submit when no product is chosen', async () => {
      const { fixture, root, close } = setUp({ mode: 'create', products: [product] });
      await fixture.whenStable();

      setValue(findByLabel(root, 'کد MI'), '1234');
      setValue(findByLabel(root, 'برند'), 'Legrand');
      setValue(findByLabel(root, 'متراژ استاندارد'), '305');

      const dialog = fixture.componentInstance as unknown as Submittable;
      await dialog.onSubmit();
      await fixture.whenStable();

      expect(close).not.toHaveBeenCalled();
      const productField = findSelectByLabel(root, 'محصول')?.closest('mat-form-field');
      expect(productField?.textContent).toContain('محصول را انتخاب کنید');
    });

    it('reports a missing active choice on that field', async () => {
      const { fixture, root, close } = setUp({ mode: 'create', products: [product] });
      await fixture.whenStable();

      const dialog = fixture.componentInstance as unknown as Selectable;
      dialog.onProductChange('product-1');
      await fixture.whenStable();

      setValue(findByLabel(root, 'کد MI'), '1234');
      setValue(findByLabel(root, 'برند'), 'Legrand');
      setValue(findByLabel(root, 'متراژ استاندارد'), '305');
      setValue(findByLabel(root, 'وزن استاندارد «میلگرد فولادی» (گرم)'), '150');
      setValue(findByLabel(root, 'وزن استاندارد «روکش رنگ» (گرم)'), '10');

      const submittable = dialog as unknown as Submittable;
      await submittable.onSubmit();
      await fixture.whenStable();

      expect(close).not.toHaveBeenCalled();
      const activeField = findSelectByLabel(root, 'فعال بودن')?.closest('mat-form-field');
      expect(activeField?.textContent).toContain('وضعیت فعال بودن را مشخص کنید');
    });

    it('reports an empty weight on that material’s field', async () => {
      const { fixture, root, close } = setUp({ mode: 'create', products: [product] });
      await fixture.whenStable();

      const dialog = fixture.componentInstance as unknown as Selectable;
      dialog.onProductChange('product-1');
      await fixture.whenStable();

      setValue(findByLabel(root, 'کد MI'), '1234');
      setValue(findByLabel(root, 'برند'), 'Legrand');
      setValue(findByLabel(root, 'متراژ استاندارد'), '305');
      setValue(findByLabel(root, 'وزن استاندارد «روکش رنگ» (گرم)'), '10');

      const submittable = dialog as unknown as Submittable;
      await submittable.onSubmit();
      await fixture.whenStable();

      expect(close).not.toHaveBeenCalled();
      const weightField = findByLabel(root, 'وزن استاندارد «میلگرد فولادی» (گرم)')?.closest(
        'mat-form-field',
      );
      expect(weightField?.textContent).toContain('وزن');
    });
  });

  describe('edit mode', () => {
    const standardBom: AppStandardBom = {
      id: 'bom-1',
      miCode: '1234',
      brand: 'Legrand',
      standardLength: 305,
      active: true,
      description: '',
      productId: 'product-1',
      components: [
        {
          id: 'component-1',
          name: 'پیچ شش‌گوش',
          materials: [{ id: 'material-1', name: 'میلگرد فولادی', weight: 150 }],
        },
      ],
    };

    it('pre-fills the form from the given standard BOM, weights included', async () => {
      const { fixture, root } = setUp({ mode: 'edit', standardBom, products: [product] });
      await fixture.whenStable();

      expect((findByLabel(root, 'کد MI') as HTMLInputElement)?.value).toBe('1234');
      expect((findByLabel(root, 'برند') as HTMLInputElement)?.value).toBe('Legrand');
      expect((findByLabel(root, 'متراژ استاندارد') as HTMLInputElement)?.value).toBe('305');
      expect(
        (findByLabel(root, 'وزن استاندارد «میلگرد فولادی» (گرم)') as HTMLInputElement)?.value,
      ).toBe('150');
      expect(root.textContent).toContain(product.name);
    });

    it('edits the standard BOM, sending the current composition back', async () => {
      const { fixture, root, close, httpMock } = setUp({
        mode: 'edit',
        standardBom,
        products: [product],
      });
      await fixture.whenStable();

      setValue(findByLabel(root, 'برند'), 'Schneider');
      await fixture.whenStable();

      const submittable = fixture.componentInstance as unknown as Submittable;
      const submitted = submittable.onSubmit();
      const request = httpMock.expectOne({ method: 'PATCH', url: '/api/standard-boms/bom-1' });
      expect(request.request.body).toEqual({
        miCode: '1234',
        brand: 'Schneider',
        standardLength: 305,
        active: true,
        components: [
          {
            componentId: 'component-1',
            materials: [{ materialId: 'material-1', weight: 150 }],
          },
        ],
      });
      request.flush(null, { status: 204, statusText: 'No Content' });
      await submitted;

      expect(close).toHaveBeenCalledWith(true);
    });

    it('reports a duplicate MI code conflict on the miCode field', async () => {
      const { fixture, root, close, httpMock } = setUp({
        mode: 'edit',
        standardBom,
        products: [product],
      });
      await fixture.whenStable();

      setValue(findByLabel(root, 'کد MI'), '5678');
      await fixture.whenStable();

      const submittable = fixture.componentInstance as unknown as Submittable;
      const submitted = submittable.onSubmit();
      const request = httpMock.expectOne({ method: 'PATCH', url: '/api/standard-boms/bom-1' });
      request.flush(
        {
          type: 'https://my-api-doc.dev/problems/standard-bom-mi-code-already-exists',
          title: 'Standard BOM MI Code Already Exists',
          status: 409,
          miCode: '5678',
        },
        { status: 409, statusText: 'Conflict' },
      );
      await submitted;
      await fixture.whenStable();

      expect(close).not.toHaveBeenCalled();
      const miCodeField = findByLabel(root, 'کد MI')?.closest('mat-form-field');
      expect(miCodeField?.textContent).toContain('کد MI');
    });
  });
});
