import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { ProductFormDialog, ProductFormDialogData } from './product-form-dialog';

/** The subset of the submit pipeline a spec needs to await directly. */
interface Submittable {
  onSubmit(): Promise<unknown>;
}

function setValue(element: Element | null, value: string): void {
  const input = element as HTMLInputElement;
  input.value = value;
  input.dispatchEvent(new Event('input'));
}

function findByLabel(root: HTMLElement, label: string): HTMLInputElement | null {
  const labels = Array.from(root.querySelectorAll('label'));
  const match = labels.find((element) => element.textContent?.trim().startsWith(label));
  const forAttr = match?.getAttribute('for');
  return forAttr ? root.querySelector(`#${forAttr}`) : null;
}

function findButton(root: HTMLElement, text: string): HTMLButtonElement | undefined {
  return Array.from(root.querySelectorAll('button')).find(
    (button) => button.textContent?.trim() === text,
  );
}

/** Every component row, in DOM order — the fieldset markup `role="group"` locates in the real app. */
function componentRows(root: HTMLElement): HTMLElement[] {
  return Array.from(root.querySelectorAll('fieldset.component-row'));
}

function materialRows(componentRow: HTMLElement): HTMLElement[] {
  return Array.from(componentRow.querySelectorAll('fieldset.material-row'));
}

function setUp(data: ProductFormDialogData) {
  const close = vi.fn();

  TestBed.configureTestingModule({
    providers: [
      provideHttpClient(),
      provideHttpClientTesting(),
      { provide: MatDialogRef, useValue: { close } },
      { provide: MAT_DIALOG_DATA, useValue: data },
    ],
  });

  const fixture = TestBed.createComponent(ProductFormDialog);
  const httpMock = TestBed.inject(HttpTestingController);

  return { fixture, close, httpMock, root: fixture.nativeElement as HTMLElement };
}

describe('ProductFormDialog', () => {
  afterEach(() => {
    TestBed.inject(HttpTestingController).verify();
  });

  describe('create mode', () => {
    it('starts with an empty name field and no component rows', async () => {
      const { fixture, root } = setUp({ mode: 'create' });
      await fixture.whenStable();

      expect(findByLabel(root, 'اسم محصول')?.value).toBe('');
      expect(componentRows(root)).toHaveLength(0);
    });

    it('adds a component row with no material rows, then a material row within it', async () => {
      const { fixture, root } = setUp({ mode: 'create' });
      await fixture.whenStable();

      findButton(root, 'افزودن جز')?.dispatchEvent(new Event('click'));
      await fixture.whenStable();

      const [row] = componentRows(root);
      expect(row).toBeDefined();
      expect(materialRows(row)).toHaveLength(0);

      findButton(row, 'افزودن مواد اولیه')?.dispatchEvent(new Event('click'));
      await fixture.whenStable();

      expect(materialRows(row)).toHaveLength(1);
    });

    it('removes a component row', async () => {
      const { fixture, root } = setUp({ mode: 'create' });
      await fixture.whenStable();

      findButton(root, 'افزودن جز')?.dispatchEvent(new Event('click'));
      await fixture.whenStable();
      expect(componentRows(root)).toHaveLength(1);

      const [row] = componentRows(root);
      findButton(row, 'حذف جز')?.dispatchEvent(new Event('click'));
      await fixture.whenStable();

      expect(componentRows(root)).toHaveLength(0);
    });

    it('removes a material row', async () => {
      const { fixture, root } = setUp({ mode: 'create' });
      await fixture.whenStable();

      findButton(root, 'افزودن جز')?.dispatchEvent(new Event('click'));
      await fixture.whenStable();
      const [row] = componentRows(root);
      findButton(row, 'افزودن مواد اولیه')?.dispatchEvent(new Event('click'));
      await fixture.whenStable();
      expect(materialRows(row)).toHaveLength(1);

      const [materialRow] = materialRows(row);
      findButton(materialRow, 'حذف مواد اولیه')?.dispatchEvent(new Event('click'));
      await fixture.whenStable();

      expect(materialRows(row)).toHaveLength(0);
    });

    it('registers the product with its nested components and materials, and closes on success', async () => {
      const { fixture, root, close, httpMock } = setUp({ mode: 'create' });
      await fixture.whenStable();

      setValue(findByLabel(root, 'اسم محصول'), 'ویجت');
      findButton(root, 'افزودن جز')?.dispatchEvent(new Event('click'));
      await fixture.whenStable();
      const [row] = componentRows(root);
      setValue(findByLabel(row, 'اسم جز'), 'پیچ شش‌گوش');
      findButton(row, 'افزودن مواد اولیه')?.dispatchEvent(new Event('click'));
      await fixture.whenStable();
      const [materialRow] = materialRows(row);
      setValue(findByLabel(materialRow, 'اسم مواد اولیه'), 'میلگرد فولادی');
      await fixture.whenStable();

      const dialog = fixture.componentInstance as unknown as Submittable;
      const submitted = dialog.onSubmit();
      const request = httpMock.expectOne({ method: 'POST', url: '/api/products' });
      expect(request.request.body).toEqual({
        name: 'ویجت',
        components: [{ name: 'پیچ شش‌گوش', materials: [{ name: 'میلگرد فولادی' }] }],
      });
      request.flush({ id: '1' }, { status: 201, statusText: 'Created' });
      await submitted;

      expect(close).toHaveBeenCalledWith(true);
    });

    it('shows a root error and does not submit when there are no components', async () => {
      const { fixture, root, close } = setUp({ mode: 'create' });
      await fixture.whenStable();

      setValue(findByLabel(root, 'اسم محصول'), 'ویجت');
      await fixture.whenStable();

      const dialog = fixture.componentInstance as unknown as Submittable;
      await dialog.onSubmit();
      await fixture.whenStable();

      expect(close).not.toHaveBeenCalled();
      const alert = root.querySelector('[role="alert"]');
      expect(alert?.textContent).toContain('هر محصول باید حداقل یک جز داشته باشد.');
    });

    it('shows a root error when a component has no materials', async () => {
      const { fixture, root, close } = setUp({ mode: 'create' });
      await fixture.whenStable();

      setValue(findByLabel(root, 'اسم محصول'), 'ویجت');
      findButton(root, 'افزودن جز')?.dispatchEvent(new Event('click'));
      await fixture.whenStable();
      const [row] = componentRows(root);
      setValue(findByLabel(row, 'اسم جز'), 'پیچ شش‌گوش');
      await fixture.whenStable();

      const dialog = fixture.componentInstance as unknown as Submittable;
      await dialog.onSubmit();
      await fixture.whenStable();

      expect(close).not.toHaveBeenCalled();
      const alert = root.querySelector('[role="alert"]');
      expect(alert?.textContent).toContain('هر جز باید حداقل یک مواد اولیه داشته باشد.');
    });

    it('reports an empty component name on that row, not the form root', async () => {
      const { fixture, root, close } = setUp({ mode: 'create' });
      await fixture.whenStable();

      setValue(findByLabel(root, 'اسم محصول'), 'ویجت');
      findButton(root, 'افزودن جز')?.dispatchEvent(new Event('click'));
      await fixture.whenStable();
      const [row] = componentRows(root);
      findButton(row, 'افزودن مواد اولیه')?.dispatchEvent(new Event('click'));
      await fixture.whenStable();
      const [materialRow] = materialRows(row);
      setValue(findByLabel(materialRow, 'اسم مواد اولیه'), 'میلگرد فولادی');
      await fixture.whenStable();

      const dialog = fixture.componentInstance as unknown as Submittable;
      await dialog.onSubmit();
      await fixture.whenStable();

      expect(close).not.toHaveBeenCalled();
      const componentField = findByLabel(row, 'اسم جز')?.closest('mat-form-field');
      expect(componentField?.textContent).toContain('نام جز را وارد کنید');
    });
  });

  describe('edit mode', () => {
    const product = {
      id: 'product-1',
      name: 'ویجت',
      components: [
        {
          id: 'component-1',
          name: 'پیچ شش‌گوش',
          materials: [{ id: 'material-1', name: 'میلگرد فولادی' }],
        },
      ],
    };

    it('pre-fills the form from the given product, components and materials included', async () => {
      const { fixture, root } = setUp({ mode: 'edit', product });
      await fixture.whenStable();

      expect(findByLabel(root, 'اسم محصول')?.value).toBe('ویجت');
      const [row] = componentRows(root);
      expect(findByLabel(row, 'اسم جز')?.value).toBe('پیچ شش‌گوش');
      const [materialRow] = materialRows(row);
      expect(findByLabel(materialRow, 'اسم مواد اولیه')?.value).toBe('میلگرد فولادی');
    });

    it('edits the product name only, sending every original id and unchanged name back for a pure rename', async () => {
      const { fixture, root, close, httpMock } = setUp({ mode: 'edit', product });
      await fixture.whenStable();

      setValue(findByLabel(root, 'اسم محصول'), 'ویجت جدید');
      await fixture.whenStable();

      const dialog = fixture.componentInstance as unknown as Submittable;
      const submitted = dialog.onSubmit();
      const request = httpMock.expectOne({ method: 'PATCH', url: '/api/products/product-1' });
      // Attaching each existing row's own id is what makes resending its unchanged name safe: the
      // backend reuses a row carrying an id from this product's current composition instead of
      // treating it as a brand-new, colliding one — see `EditProductComponentDto`/
      // `EditProductMaterialDto`. Sending `components` is no longer something to dodge.
      expect(request.request.body).toEqual({
        name: 'ویجت جدید',
        components: [
          {
            id: 'component-1',
            name: 'پیچ شش‌گوش',
            materials: [{ id: 'material-1', name: 'میلگرد فولادی' }],
          },
        ],
      });
      request.flush(null, { status: 204, statusText: 'No Content' });
      await submitted;

      expect(close).toHaveBeenCalledWith(true);
    });

    it('attaches ids to the existing component and material and omits one for a freshly added material', async () => {
      const { fixture, root, close, httpMock } = setUp({ mode: 'edit', product });
      await fixture.whenStable();

      const [row] = componentRows(root);
      findButton(row, 'افزودن مواد اولیه')?.dispatchEvent(new Event('click'));
      await fixture.whenStable();
      const [, newMaterialRow] = materialRows(row);
      setValue(findByLabel(newMaterialRow, 'اسم مواد اولیه'), 'روکش رنگ');
      await fixture.whenStable();

      const dialog = fixture.componentInstance as unknown as Submittable;
      const submitted = dialog.onSubmit();
      const request = httpMock.expectOne({ method: 'PATCH', url: '/api/products/product-1' });
      expect(request.request.body).toEqual({
        name: 'ویجت',
        components: [
          {
            id: 'component-1',
            name: 'پیچ شش‌گوش',
            materials: [{ id: 'material-1', name: 'میلگرد فولادی' }, { name: 'روکش رنگ' }],
          },
        ],
      });
      request.flush(null, { status: 204, statusText: 'No Content' });
      await submitted;

      expect(close).toHaveBeenCalledWith(true);
    });

    it('keeps each remaining row paired with its own id after an earlier row is removed', async () => {
      const twoComponentProduct = {
        id: 'product-1',
        name: 'ویجت',
        components: [
          {
            id: 'component-1',
            name: 'جز یک',
            materials: [{ id: 'material-1', name: 'مواد یک' }],
          },
          {
            id: 'component-2',
            name: 'جز دو',
            materials: [{ id: 'material-2', name: 'مواد دو' }],
          },
        ],
      };
      const { fixture, root, close, httpMock } = setUp({
        mode: 'edit',
        product: twoComponentProduct,
      });
      await fixture.whenStable();

      // Removing the first row must not shift `component-2`'s id onto the row that slides into its
      // place — an index-based reconciliation done at submit time would get this wrong.
      const [firstRow] = componentRows(root);
      findButton(firstRow, 'حذف جز')?.dispatchEvent(new Event('click'));
      await fixture.whenStable();

      const dialog = fixture.componentInstance as unknown as Submittable;
      const submitted = dialog.onSubmit();
      const request = httpMock.expectOne({ method: 'PATCH', url: '/api/products/product-1' });
      expect(request.request.body).toEqual({
        name: 'ویجت',
        components: [
          {
            id: 'component-2',
            name: 'جز دو',
            materials: [{ id: 'material-2', name: 'مواد دو' }],
          },
        ],
      });
      request.flush(null, { status: 204, statusText: 'No Content' });
      await submitted;

      expect(close).toHaveBeenCalledWith(true);
    });

    it('shows a root error when a component added to an already-populated edit form has no materials', async () => {
      const { fixture, root, close } = setUp({ mode: 'edit', product });
      await fixture.whenStable();

      // The existing component (with its own material) is already on the form when this one is
      // added — unlike the create-mode "no materials" test above, which starts from nothing. This
      // is the shape that regressed: a fresh row's own field getting touched, alongside an
      // already-populated one, failed to bubble up to the root banner.
      findButton(root, 'افزودن جز')?.dispatchEvent(new Event('click'));
      await fixture.whenStable();
      const [, newRow] = componentRows(root);
      setValue(findByLabel(newRow, 'اسم جز'), 'جز جدید');
      await fixture.whenStable();

      const dialog = fixture.componentInstance as unknown as Submittable;
      await dialog.onSubmit();
      await fixture.whenStable();

      expect(close).not.toHaveBeenCalled();
      const alert = root.querySelector('[role="alert"]');
      expect(alert?.textContent).toContain('هر جز باید حداقل یک مواد اولیه داشته باشد.');
    });
  });
});
