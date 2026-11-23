import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestbedHarnessEnvironment } from '@angular/cdk/testing/testbed';
import { TestBed } from '@angular/core/testing';
import { MatAutocompleteHarness } from '@angular/material/autocomplete/testing';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { PROBLEM } from '../../core/http/problem-details';
import { AppComponent as AppComponentRecord } from '../../core/components/components-gateway';
import { AppMaterial } from '../../core/materials/materials-gateway';
import {
  CONFLICT,
  recordHasDependentsBody,
} from '../../core/http/testing/record-has-dependents-problem';
import { Role } from '../../api/model';
import { signInAs } from '../../core/identity/testing/sign-in-as';
import {
  answerCorrectionConfirmation,
  askedToConfirm,
} from '../../ui/correction-confirmation/testing/answer-correction-confirmation';
import { ProductFormDialog, ProductFormDialogData } from './product-form-dialog';

/** The subset of the submit pipeline a spec needs to await directly. */
interface Submittable {
  onSubmit(): Promise<unknown>;
}

/** The one selection event a spec has to drive directly: a native `mat-select` overlay doesn't open
 * in jsdom the way a click would in a real browser, so tests call the dialog's own
 * `(selectionChange)` handlers exactly as the template does — see `bom-form-dialog.spec.ts` for the
 * same convention. */
interface Selectable {
  onComponentNameChange(componentIndex: number, name: string): void;
  onMaterialNameChange(componentIndex: number, materialIndex: number, name: string): void;
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

/** Every component row, in DOM order — the fieldset markup `role="group"` locates in the real app. */
function componentRows(root: HTMLElement): HTMLElement[] {
  return Array.from(root.querySelectorAll('fieldset.component-row'));
}

function materialRows(componentRow: HTMLElement): HTMLElement[] {
  return Array.from(componentRow.querySelectorAll('fieldset.material-row'));
}

/** A button by its visible text. */
function buttonWithText(root: HTMLElement, text: string): HTMLButtonElement | undefined {
  return Array.from(root.querySelectorAll('button')).find(
    (button) => button.textContent?.trim() === text,
  );
}

/** A button by its accessible name — how the acceptance suite finds the reorder controls. */
function buttonNamed(root: HTMLElement, name: string): HTMLButtonElement | undefined {
  return Array.from(root.querySelectorAll('button')).find(
    (button) => button.getAttribute('aria-label') === name,
  );
}

/** The component names on screen, top to bottom. */
function componentNamesOnScreen(root: HTMLElement): (string | undefined)[] {
  return componentRows(root).map((row) => findByLabel(row, 'اسم جز')?.value);
}

/** The registered `components`/`materials` lists the picker is built from — broad enough to cover
 * every name any test below selects, mirroring how the real lists span every product. */
const registeredComponents: AppComponentRecord[] = [
  { id: 'rc-1', name: 'پیچ شش‌گوش' },
  { id: 'rc-2', name: 'جز یک' },
  { id: 'rc-3', name: 'جز دو' },
  { id: 'rc-4', name: 'جز جدید' },
];
const registeredMaterials: AppMaterial[] = [
  { id: 'rm-1', name: 'میلگرد فولادی', code: 'RM-001' },
  { id: 'rm-2', name: 'روکش رنگ', code: 'PT-12' },
  { id: 'rm-3', name: 'مواد یک', code: 'M-1' },
  { id: 'rm-4', name: 'مواد دو', code: 'M-2' },
];

/** Plain `Omit` over a discriminated union collapses the discriminant — this distributes it over
 * each member first, so `{ mode: 'edit'; product }` still type-checks. */
type DistributiveOmit<T, K extends PropertyKey> = T extends unknown ? Omit<T, K> : never;

function setUp(data: DistributiveOmit<ProductFormDialogData, 'components' | 'materials'>) {
  const close = vi.fn();

  TestBed.configureTestingModule({
    providers: [
      provideHttpClient(),
      provideHttpClientTesting(),
      { provide: MatDialogRef, useValue: { close } },
      {
        provide: MAT_DIALOG_DATA,
        useValue: { ...data, components: registeredComponents, materials: registeredMaterials },
      },
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

      Array.from(root.querySelectorAll('button'))
        .find((button) => button.textContent?.trim() === 'افزودن جز')
        ?.dispatchEvent(new Event('click'));
      await fixture.whenStable();

      const [row] = componentRows(root);
      expect(row).toBeDefined();
      expect(materialRows(row)).toHaveLength(0);

      Array.from(row.querySelectorAll('button'))
        .find((button) => button.textContent?.trim() === 'افزودن مواد اولیه')
        ?.dispatchEvent(new Event('click'));
      await fixture.whenStable();

      expect(materialRows(row)).toHaveLength(1);
    });

    it('removes a component row', async () => {
      const { fixture, root } = setUp({ mode: 'create' });
      await fixture.whenStable();

      Array.from(root.querySelectorAll('button'))
        .find((button) => button.textContent?.trim() === 'افزودن جز')
        ?.dispatchEvent(new Event('click'));
      await fixture.whenStable();
      expect(componentRows(root)).toHaveLength(1);

      const [row] = componentRows(root);
      Array.from(row.querySelectorAll('button'))
        .find((button) => button.textContent?.trim() === 'حذف جز')
        ?.dispatchEvent(new Event('click'));
      await fixture.whenStable();

      expect(componentRows(root)).toHaveLength(0);
    });

    it('removes a material row', async () => {
      const { fixture, root } = setUp({ mode: 'create' });
      await fixture.whenStable();

      Array.from(root.querySelectorAll('button'))
        .find((button) => button.textContent?.trim() === 'افزودن جز')
        ?.dispatchEvent(new Event('click'));
      await fixture.whenStable();
      const [row] = componentRows(root);
      Array.from(row.querySelectorAll('button'))
        .find((button) => button.textContent?.trim() === 'افزودن مواد اولیه')
        ?.dispatchEvent(new Event('click'));
      await fixture.whenStable();
      expect(materialRows(row)).toHaveLength(1);

      const [materialRow] = materialRows(row);
      Array.from(materialRow.querySelectorAll('button'))
        .find((button) => button.textContent?.trim() === 'حذف مواد اولیه')
        ?.dispatchEvent(new Event('click'));
      await fixture.whenStable();

      expect(materialRows(row)).toHaveLength(0);
    });

    it('registers the product with its nested components and materials, and closes with the registered product', async () => {
      const { fixture, root, close, httpMock } = setUp({ mode: 'create' });
      await fixture.whenStable();

      setValue(findByLabel(root, 'اسم محصول'), 'ویجت');
      Array.from(root.querySelectorAll('button'))
        .find((button) => button.textContent?.trim() === 'افزودن جز')
        ?.dispatchEvent(new Event('click'));
      await fixture.whenStable();

      const dialog = fixture.componentInstance as unknown as Selectable;
      dialog.onComponentNameChange(0, 'پیچ شش‌گوش');
      await fixture.whenStable();

      const [row] = componentRows(root);
      Array.from(row.querySelectorAll('button'))
        .find((button) => button.textContent?.trim() === 'افزودن مواد اولیه')
        ?.dispatchEvent(new Event('click'));
      await fixture.whenStable();
      dialog.onMaterialNameChange(0, 0, 'میلگرد فولادی');
      await fixture.whenStable();

      const submittable = dialog as unknown as Submittable;
      const submitted = submittable.onSubmit();
      const request = httpMock.expectOne({ method: 'POST', url: '/api/products' });
      expect(request.request.body).toEqual({
        name: 'ویجت',
        components: [{ name: 'پیچ شش‌گوش', materials: [{ name: 'میلگرد فولادی' }] }],
      });
      request.flush(
        {
          id: '1',
          name: 'ویجت',
          components: [
            { id: 'c1', name: 'پیچ شش‌گوش', materials: [{ id: 'm1', name: 'میلگرد فولادی' }] },
          ],
        },
        { status: 201, statusText: 'Created' },
      );
      await submitted;

      expect(close).toHaveBeenCalledWith({
        id: '1',
        name: 'ویجت',
        components: [
          { id: 'c1', name: 'پیچ شش‌گوش', materials: [{ id: 'm1', name: 'میلگرد فولادی' }] },
        ],
      });
    });

    it("finds a material in its picker by the material's code, lists it by name alone, and stores the name", async () => {
      const { fixture, root, close, httpMock } = setUp({ mode: 'create' });
      await fixture.whenStable();

      setValue(findByLabel(root, 'اسم محصول'), 'ویجت');
      Array.from(root.querySelectorAll('button'))
        .find((button) => button.textContent?.trim() === 'افزودن جز')
        ?.dispatchEvent(new Event('click'));
      await fixture.whenStable();
      const dialog = fixture.componentInstance as unknown as Selectable;
      dialog.onComponentNameChange(0, 'پیچ شش‌گوش');
      await fixture.whenStable();

      const [row] = componentRows(root);
      Array.from(row.querySelectorAll('button'))
        .find((button) => button.textContent?.trim() === 'افزودن مواد اولیه')
        ?.dispatchEvent(new Event('click'));
      await fixture.whenStable();

      const loader = TestbedHarnessEnvironment.loader(fixture);
      const [, materialPicker] = await loader.getAllHarnesses(MatAutocompleteHarness);
      await materialPicker.enterText('pt-12');
      const options = await materialPicker.getOptions();
      expect(await Promise.all(options.map((option) => option.getText()))).toEqual(['روکش رنگ']);
      await options[0].click();
      await fixture.whenStable();

      const submitted = (dialog as unknown as Submittable).onSubmit();
      const request = httpMock.expectOne({ method: 'POST', url: '/api/products' });
      expect(request.request.body).toEqual({
        name: 'ویجت',
        components: [{ name: 'پیچ شش‌گوش', materials: [{ name: 'روکش رنگ' }] }],
      });
      request.flush({ id: '1' }, { status: 201, statusText: 'Created' });
      await submitted;

      expect(close).toHaveBeenCalledWith(expect.objectContaining({ id: '1' }));
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
      Array.from(root.querySelectorAll('button'))
        .find((button) => button.textContent?.trim() === 'افزودن جز')
        ?.dispatchEvent(new Event('click'));
      await fixture.whenStable();

      const dialog = fixture.componentInstance as unknown as Selectable;
      dialog.onComponentNameChange(0, 'پیچ شش‌گوش');
      await fixture.whenStable();

      const submittable = dialog as unknown as Submittable;
      await submittable.onSubmit();
      await fixture.whenStable();

      expect(close).not.toHaveBeenCalled();
      const alert = root.querySelector('[role="alert"]');
      expect(alert?.textContent).toContain('هر جز باید حداقل یک مواد اولیه داشته باشد.');
    });

    it('reports an unselected component name on that row, not the form root', async () => {
      const { fixture, root, close } = setUp({ mode: 'create' });
      await fixture.whenStable();

      setValue(findByLabel(root, 'اسم محصول'), 'ویجت');
      Array.from(root.querySelectorAll('button'))
        .find((button) => button.textContent?.trim() === 'افزودن جز')
        ?.dispatchEvent(new Event('click'));
      await fixture.whenStable();
      const [row] = componentRows(root);
      Array.from(row.querySelectorAll('button'))
        .find((button) => button.textContent?.trim() === 'افزودن مواد اولیه')
        ?.dispatchEvent(new Event('click'));
      await fixture.whenStable();

      const dialog = fixture.componentInstance as unknown as Selectable;
      dialog.onMaterialNameChange(0, 0, 'میلگرد فولادی');
      await fixture.whenStable();

      const submittable = dialog as unknown as Submittable;
      await submittable.onSubmit();
      await fixture.whenStable();

      expect(close).not.toHaveBeenCalled();
      const componentField = findByLabel(row, 'اسم جز')?.closest('mat-form-field');
      expect(componentField?.textContent).toContain('یک جز را انتخاب کنید');
    });

    it('reports a component that is no longer registered on that component field', async () => {
      const { fixture, root, close, httpMock } = setUp({ mode: 'create' });
      await fixture.whenStable();

      setValue(findByLabel(root, 'اسم محصول'), 'ویجت');
      Array.from(root.querySelectorAll('button'))
        .find((button) => button.textContent?.trim() === 'افزودن جز')
        ?.dispatchEvent(new Event('click'));
      await fixture.whenStable();
      const dialog = fixture.componentInstance as unknown as Selectable;
      dialog.onComponentNameChange(0, 'پیچ شش‌گوش');
      await fixture.whenStable();
      const [row] = componentRows(root);
      Array.from(row.querySelectorAll('button'))
        .find((button) => button.textContent?.trim() === 'افزودن مواد اولیه')
        ?.dispatchEvent(new Event('click'));
      await fixture.whenStable();
      dialog.onMaterialNameChange(0, 0, 'میلگرد فولادی');
      await fixture.whenStable();

      const submittable = dialog as unknown as Submittable;
      const submitted = submittable.onSubmit();
      const request = httpMock.expectOne({ method: 'POST', url: '/api/products' });
      request.flush(
        {
          type: PROBLEM.componentNotRegistered,
          title: 'Component Not Registered',
          status: 400,
          componentName: 'پیچ شش‌گوش',
        },
        { status: 400, statusText: 'Bad Request' },
      );
      await submitted;
      await fixture.whenStable();

      expect(close).not.toHaveBeenCalled();
      const componentField = findByLabel(row, 'اسم جز')?.closest('mat-form-field');
      expect(componentField?.textContent).toContain('این جز ثبت نشده است');
    });
  });

  describe('create mode from a similar product (issue #133)', () => {
    const source = {
      id: 'product-1',
      name: 'کابل منبع',
      components: [
        { id: 'component-2', name: 'جز دو', materials: [{ id: 'material-4', name: 'مواد دو' }] },
        {
          id: 'component-1',
          name: 'جز یک',
          materials: [
            { id: 'material-3', name: 'مواد یک' },
            { id: 'material-1', name: 'میلگرد فولادی' },
          ],
        },
      ],
    };

    it('opens as the create form, pre-filled with the name and every component and material in the stored order', async () => {
      const { fixture, root } = setUp({ mode: 'create', source });
      await fixture.whenStable();

      expect(root.querySelector('app-dialog-head')?.textContent).toContain('افزودن محصول');
      expect(findByLabel(root, 'اسم محصول')?.value).toBe('کابل منبع');
      expect(componentNamesOnScreen(root)).toEqual(['جز دو', 'جز یک']);
      const materialsOnScreen = componentRows(root).map((row) =>
        materialRows(row).map((materialRow) => findByLabel(materialRow, 'اسم مواد اولیه')?.value),
      );
      expect(materialsOnScreen).toEqual([['مواد دو'], ['مواد یک', 'میلگرد فولادی']]);
    });

    it("registers the copy as a new product, carrying none of the source's ids", async () => {
      const { fixture, root, close, httpMock } = setUp({ mode: 'create', source });
      await fixture.whenStable();

      setValue(findByLabel(root, 'اسم محصول'), 'کابل مشابه');
      await fixture.whenStable();

      const submitted = (fixture.componentInstance as unknown as Submittable).onSubmit();
      const request = httpMock.expectOne({ method: 'POST', url: '/api/products' });
      expect(request.request.body).toEqual({
        name: 'کابل مشابه',
        components: [
          { name: 'جز دو', materials: [{ name: 'مواد دو' }] },
          { name: 'جز یک', materials: [{ name: 'مواد یک' }, { name: 'میلگرد فولادی' }] },
        ],
      });
      request.flush(
        { id: 'product-2', name: 'کابل مشابه' },
        { status: 201, statusText: 'Created' },
      );
      await submitted;

      expect(close).toHaveBeenCalledWith(expect.objectContaining({ id: 'product-2' }));
    });
  });

  describe('empty registered lists', () => {
    it('offers no way to add a component when none is registered', async () => {
      const close = vi.fn();
      TestBed.configureTestingModule({
        providers: [
          provideHttpClient(),
          provideHttpClientTesting(),
          { provide: MatDialogRef, useValue: { close } },
          { provide: MAT_DIALOG_DATA, useValue: { mode: 'create', components: [], materials: [] } },
        ],
      });
      const fixture = TestBed.createComponent(ProductFormDialog);
      await fixture.whenStable();
      const root = fixture.nativeElement as HTMLElement;

      expect(
        Array.from(root.querySelectorAll('button')).find(
          (button) => button.textContent?.trim() === 'افزودن جز',
        ),
      ).toBeUndefined();
      expect(root.textContent).toContain('هیچ جزی ثبت نشده است');
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
      Array.from(row.querySelectorAll('button'))
        .find((button) => button.textContent?.trim() === 'افزودن مواد اولیه')
        ?.dispatchEvent(new Event('click'));
      await fixture.whenStable();
      const dialog = fixture.componentInstance as unknown as Selectable;
      dialog.onMaterialNameChange(0, 1, 'روکش رنگ');
      await fixture.whenStable();

      const submittable = dialog as unknown as Submittable;
      const submitted = submittable.onSubmit();
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
      Array.from(firstRow.querySelectorAll('button'))
        .find((button) => button.textContent?.trim() === 'حذف جز')
        ?.dispatchEvent(new Event('click'));
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

    it('says which standard BOM uses the product and keeps the edited composition when a change is refused', async () => {
      const { fixture, root, close, httpMock } = setUp({ mode: 'edit', product });
      await fixture.whenStable();

      const [row] = componentRows(root);
      Array.from(row.querySelectorAll('button'))
        .find((button) => button.textContent?.trim() === 'افزودن مواد اولیه')
        ?.dispatchEvent(new Event('click'));
      await fixture.whenStable();
      const dialog = fixture.componentInstance as unknown as Selectable;
      dialog.onMaterialNameChange(0, 1, 'روکش رنگ');
      await fixture.whenStable();

      const submitted = (dialog as unknown as Submittable).onSubmit();
      httpMock
        .expectOne({ method: 'PATCH', url: '/api/products/product-1' })
        .flush(
          recordHasDependentsBody(
            [{ kind: 'standard-bom', count: 1, names: ['MI-100'] }],
            'Product',
          ),
          CONFLICT,
        );
      await submitted;
      await fixture.whenStable();

      expect(close).not.toHaveBeenCalled();
      expect(root.querySelector('[role="alert"]')?.textContent).toContain(
        'امکان ویرایش این اطلاعات وجود ندارد، زیرا در ۱ آنالیز استاندارد («MI-100») استفاده شده است.',
      );
      const [refusedRow] = componentRows(root);
      expect(findByLabel(refusedRow, 'اسم جز')?.value).toBe('پیچ شش‌گوش');
      expect(materialRows(refusedRow)).toHaveLength(2);
    });

    it('shows a root error when a component added to an already-populated edit form has no materials', async () => {
      const { fixture, root, close } = setUp({ mode: 'edit', product });
      await fixture.whenStable();

      // The existing component (with its own material) is already on the form when this one is
      // added — unlike the create-mode "no materials" test above, which starts from nothing. This
      // is the shape that regressed: a fresh row's own field getting touched, alongside an
      // already-populated one, failed to bubble up to the root banner.
      Array.from(root.querySelectorAll('button'))
        .find((button) => button.textContent?.trim() === 'افزودن جز')
        ?.dispatchEvent(new Event('click'));
      await fixture.whenStable();
      const dialog = fixture.componentInstance as unknown as Selectable;
      dialog.onComponentNameChange(1, 'جز جدید');
      await fixture.whenStable();

      const submittable = dialog as unknown as Submittable;
      await submittable.onSubmit();
      await fixture.whenStable();

      expect(close).not.toHaveBeenCalled();
      const alert = root.querySelector('[role="alert"]');
      expect(alert?.textContent).toContain('هر جز باید حداقل یک مواد اولیه داشته باشد.');
    });
  });

  describe("the System Admin's correction of a product in use (issue #110)", () => {
    const product = {
      id: 'product-1',
      name: 'کابل NYY',
      components: [
        {
          id: 'component-1',
          name: 'پیچ شش‌گوش',
          materials: [{ id: 'material-1', name: 'میلگرد فولادی' }],
        },
      ],
    };
    const PATCH = { method: 'PATCH', url: '/api/products/product-1' };
    const IN_USE = recordHasDependentsBody(
      [{ kind: 'standard-bom', count: 1, names: ['MI-100'] }],
      'Product',
    );

    async function editAsSystemAdmin(answer: boolean) {
      localStorage.clear();
      const context = setUp({ mode: 'edit', product });
      const open = answerCorrectionConfirmation(answer);
      await signInAs(Role.system_admin, context.httpMock);
      await context.fixture.whenStable();
      return { ...context, open };
    }

    it('re-sends a rename with the correction applied once confirmed', async () => {
      const { fixture, root, close, httpMock, open } = await editAsSystemAdmin(true);
      setValue(findByLabel(root, 'اسم محصول'), 'کابل NYY-J');
      await fixture.whenStable();

      const submitted = (fixture.componentInstance as unknown as Submittable).onSubmit();
      httpMock.expectOne(PATCH).flush(IN_USE, CONFLICT);
      const corrected = await vi.waitFor(() => httpMock.expectOne(PATCH));
      expect(corrected.request.body).toEqual({
        name: 'کابل NYY-J',
        components: product.components,
        applyToRelatedRecords: true,
      });
      corrected.flush(null, { status: 204, statusText: 'No Content' });
      await submitted;

      expect(askedToConfirm(open)).toBe(true);
      expect(close).toHaveBeenCalledWith(true);
    });

    it('still refuses, without asking, an edit that changes the composition too', async () => {
      const { fixture, root, close, httpMock, open } = await editAsSystemAdmin(true);
      setValue(findByLabel(root, 'اسم محصول'), 'کابل NYY-J');
      const [row] = componentRows(root);
      Array.from(row.querySelectorAll('button'))
        .find((button) => button.textContent?.trim() === 'افزودن مواد اولیه')
        ?.dispatchEvent(new Event('click'));
      await fixture.whenStable();
      (fixture.componentInstance as unknown as Selectable).onMaterialNameChange(0, 1, 'روکش رنگ');
      await fixture.whenStable();

      const submitted = (fixture.componentInstance as unknown as Submittable).onSubmit();
      httpMock.expectOne(PATCH).flush(IN_USE, CONFLICT);
      await submitted;
      await fixture.whenStable();

      expect(askedToConfirm(open)).toBe(false);
      expect(close).not.toHaveBeenCalled();
      expect(root.querySelector('[role="alert"]')?.textContent).toContain(
        'امکان ویرایش این اطلاعات وجود ندارد',
      );
    });
  });

  describe('component order (issue #122)', () => {
    const product = {
      id: 'product-1',
      name: 'کابل NYY',
      components: [
        { id: 'component-1', name: 'جز یک', materials: [{ id: 'material-1', name: 'مواد یک' }] },
        { id: 'component-2', name: 'جز دو', materials: [{ id: 'material-2', name: 'مواد دو' }] },
        {
          id: 'component-3',
          name: 'پیچ شش‌گوش',
          materials: [
            { id: 'material-3', name: 'میلگرد فولادی' },
            { id: 'material-4', name: 'روکش رنگ' },
          ],
        },
      ],
    };
    const PATCH = { method: 'PATCH', url: '/api/products/product-1' };
    const IN_USE = recordHasDependentsBody(
      [{ kind: 'standard-bom', count: 1, names: ['MI-100'] }],
      'Product',
    );

    it("names each row's move buttons by its component, the first up and the last down disabled", async () => {
      const { fixture, root } = setUp({ mode: 'edit', product });
      await fixture.whenStable();

      expect(buttonNamed(root, 'انتقال جز یک به بالا')?.disabled).toBe(true);
      expect(buttonNamed(root, 'انتقال جز یک به پایین')?.disabled).toBe(false);
      expect(buttonNamed(root, 'انتقال جز دو به بالا')?.disabled).toBe(false);
      expect(buttonNamed(root, 'انتقال جز دو به پایین')?.disabled).toBe(false);
      expect(buttonNamed(root, 'انتقال پیچ شش‌گوش به بالا')?.disabled).toBe(false);
      expect(buttonNamed(root, 'انتقال پیچ شش‌گوش به پایین')?.disabled).toBe(true);
    });

    it('names a row with no component chosen yet by its position', async () => {
      const { fixture, root } = setUp({ mode: 'edit', product });
      await fixture.whenStable();

      buttonWithText(root, 'افزودن جز')?.dispatchEvent(new Event('click'));
      await fixture.whenStable();

      expect(buttonNamed(root, 'انتقال جز ۴ به بالا')?.disabled).toBe(false);
      expect(buttonNamed(root, 'انتقال جز ۴ به پایین')?.disabled).toBe(true);
    });

    it('moves a component down together with its materials', async () => {
      const { fixture, root } = setUp({ mode: 'edit', product });
      await fixture.whenStable();

      buttonNamed(root, 'انتقال جز یک به پایین')?.dispatchEvent(new Event('click'));
      await fixture.whenStable();

      expect(componentNamesOnScreen(root)).toEqual(['جز دو', 'جز یک', 'پیچ شش‌گوش']);
      const movedRow = componentRows(root)[1];
      expect(findByLabel(materialRows(movedRow)[0], 'اسم مواد اولیه')?.value).toBe('مواد یک');
      expect(buttonNamed(root, 'انتقال جز دو به بالا')?.disabled).toBe(true);
    });

    it('moves a component up together with its materials', async () => {
      const { fixture, root } = setUp({ mode: 'edit', product });
      await fixture.whenStable();

      buttonNamed(root, 'انتقال پیچ شش‌گوش به بالا')?.dispatchEvent(new Event('click'));
      await fixture.whenStable();

      expect(componentNamesOnScreen(root)).toEqual(['جز یک', 'پیچ شش‌گوش', 'جز دو']);
      expect(materialRows(componentRows(root)[1])).toHaveLength(2);
    });

    it('keeps focus on the moved component, on its other button once it reaches an end', async () => {
      const { fixture, root } = setUp({ mode: 'edit', product });
      document.body.appendChild(root);
      await fixture.whenStable();

      buttonNamed(root, 'انتقال جز دو به بالا')?.dispatchEvent(new Event('click'));
      await fixture.whenStable();

      expect(document.activeElement?.getAttribute('aria-label')).toBe('انتقال جز دو به پایین');
      root.remove();
    });

    it('keeps focus on the same button while the moved component can go further', async () => {
      const { fixture, root } = setUp({ mode: 'edit', product });
      document.body.appendChild(root);
      await fixture.whenStable();

      buttonNamed(root, 'انتقال جز یک به پایین')?.dispatchEvent(new Event('click'));
      await fixture.whenStable();

      expect(document.activeElement?.getAttribute('aria-label')).toBe('انتقال جز یک به پایین');
      root.remove();
    });

    it('registers the components in the order on screen', async () => {
      const { fixture, root, close, httpMock } = setUp({ mode: 'create' });
      await fixture.whenStable();
      const dialog = fixture.componentInstance as unknown as Selectable & Submittable;
      for (const [index, [component, material]] of [
        ['جز یک', 'مواد یک'],
        ['جز دو', 'مواد دو'],
      ].entries()) {
        buttonWithText(root, 'افزودن جز')?.dispatchEvent(new Event('click'));
        await fixture.whenStable();
        buttonWithText(componentRows(root)[index], 'افزودن مواد اولیه')?.dispatchEvent(
          new Event('click'),
        );
        await fixture.whenStable();
        dialog.onComponentNameChange(index, component);
        dialog.onMaterialNameChange(index, 0, material);
      }
      setValue(findByLabel(root, 'اسم محصول'), 'کابل تازه');
      await fixture.whenStable();

      buttonNamed(root, 'انتقال جز دو به بالا')?.dispatchEvent(new Event('click'));
      await fixture.whenStable();

      const submitted = dialog.onSubmit();
      const request = httpMock.expectOne({ method: 'POST', url: '/api/products' });
      expect(request.request.body).toEqual({
        name: 'کابل تازه',
        components: [
          { name: 'جز دو', materials: [{ name: 'مواد دو' }] },
          { name: 'جز یک', materials: [{ name: 'مواد یک' }] },
        ],
      });
      request.flush({ id: '1' }, { status: 201, statusText: 'Created' });
      await submitted;

      expect(close).toHaveBeenCalledWith(expect.objectContaining({ id: '1' }));
    });

    it('sends an edit with the components in the order on screen, each keeping its own ids', async () => {
      const { fixture, root, close, httpMock } = setUp({ mode: 'edit', product });
      await fixture.whenStable();

      buttonNamed(root, 'انتقال پیچ شش‌گوش به بالا')?.dispatchEvent(new Event('click'));
      await fixture.whenStable();
      buttonNamed(root, 'انتقال پیچ شش‌گوش به بالا')?.dispatchEvent(new Event('click'));
      await fixture.whenStable();

      const submitted = (fixture.componentInstance as unknown as Submittable).onSubmit();
      const request = httpMock.expectOne(PATCH);
      expect(request.request.body).toEqual({
        name: 'کابل NYY',
        components: [product.components[2], product.components[0], product.components[1]],
      });
      request.flush(null, { status: 204, statusText: 'No Content' });
      await submitted;

      expect(close).toHaveBeenCalledWith(true);
    });

    it("lets the System Admin correct a product in use's name while reordering it", async () => {
      localStorage.clear();
      const { fixture, root, close, httpMock } = setUp({ mode: 'edit', product });
      const open = answerCorrectionConfirmation(true);
      await signInAs(Role.system_admin, httpMock);
      await fixture.whenStable();

      setValue(findByLabel(root, 'اسم محصول'), 'کابل NYY-J');
      buttonNamed(root, 'انتقال جز یک به پایین')?.dispatchEvent(new Event('click'));
      await fixture.whenStable();

      const submitted = (fixture.componentInstance as unknown as Submittable).onSubmit();
      httpMock.expectOne(PATCH).flush(IN_USE, CONFLICT);
      const corrected = await vi.waitFor(() => httpMock.expectOne(PATCH));
      expect(corrected.request.body).toEqual({
        name: 'کابل NYY-J',
        components: [product.components[1], product.components[0], product.components[2]],
        applyToRelatedRecords: true,
      });
      corrected.flush(null, { status: 204, statusText: 'No Content' });
      await submitted;

      expect(askedToConfirm(open)).toBe(true);
      expect(close).toHaveBeenCalledWith(true);
    });
  });
});
