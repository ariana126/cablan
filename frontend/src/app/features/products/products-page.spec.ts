import { Clipboard } from '@angular/cdk/clipboard';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ApplicationRef } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { MatDialog, MatDialogRef } from '@angular/material/dialog';
import { MatSnackBar, MatSnackBarRef, TextOnlySnackBar } from '@angular/material/snack-bar';
import { provideRouter } from '@angular/router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { Role } from '../../api/model';
import { AppProduct } from '../../core/products/products-gateway';
import { signInAs } from '../../core/identity/testing/sign-in-as';
import { StandardBomFormDialog } from '../standard-boms/standard-bom-form-dialog';
import { ConfirmDeleteProductDialog } from './confirm-delete-product-dialog';
import { OfferStandardBomDialog } from './offer-standard-bom-dialog';
import { ProductFormDialog } from './product-form-dialog';
import { ProductsPage } from './products-page';

const products = [
  {
    id: '1',
    name: 'ویجت',
    components: [
      { id: 'c1', name: 'پیچ شش‌گوش', materials: [{ id: 'm1', name: 'میلگرد فولادی' }] },
    ],
  },
  { id: '2', name: 'گجت', components: [] },
];

/** The registered `components`/`materials` lists the create/edit dialog's pickers are built from. */
const registeredComponents = [{ id: 'c1', name: 'پیچ شش‌گوش' }];
const registeredMaterials = [{ id: 'm1', name: 'میلگرد فولادی', code: 'RM-001' }];

/**
 * Creates the page and forces one synchronous tick so every resource's initial request is actually
 * dispatched, then flushes the two supporting lists the create/edit dialog needs — every test
 * exercises these regardless of what it asserts on, mirroring `boms-page.spec.ts`'s
 * `flushSupportingRequests`. `whenStable()` cannot be used for the products list itself, because
 * that is the one request left deliberately unflushed until the test gets to assert on it.
 */
function setUp() {
  TestBed.configureTestingModule({
    providers: [provideHttpClient(), provideHttpClientTesting(), provideRouter([])],
  });

  return createPage();
}

/** `setUp`, signed in as `role` first — for what the page offers by role. */
async function setUpAs(role: Role) {
  TestBed.configureTestingModule({
    providers: [provideHttpClient(), provideHttpClientTesting(), provideRouter([])],
  });
  await signInAs(role, TestBed.inject(HttpTestingController));

  return createPage();
}

function createPage() {
  const fixture = TestBed.createComponent(ProductsPage);
  const httpMock = TestBed.inject(HttpTestingController);
  TestBed.inject(ApplicationRef).tick();

  httpMock.expectOne({ method: 'GET', url: '/api/components' }).flush(registeredComponents);
  httpMock.expectOne({ method: 'GET', url: '/api/materials' }).flush(registeredMaterials);

  return {
    fixture,
    httpMock,
    root: fixture.nativeElement as HTMLElement,
  };
}

/** The product `POST /api/products` answered with, as the create dialog closes with it. */
const registeredProduct: AppProduct = {
  id: '3',
  name: 'کابل تازه',
  components: [{ id: 'c1', name: 'پیچ شش‌گوش', materials: [{ id: 'm1', name: 'میلگرد فولادی' }] }],
};

/** Stubs `MatDialog.open` so each dialog component closes with the answer given for it. */
function answerDialogs(answers: Map<unknown, unknown>) {
  return vi
    .spyOn(TestBed.inject(MatDialog), 'open')
    .mockImplementation(
      (component: unknown) =>
        ({ afterClosed: () => of(answers.get(component)) }) as MatDialogRef<unknown, unknown>,
    );
}

function clickAddProduct(root: HTMLElement): void {
  Array.from(root.querySelectorAll('button'))
    .find((button) => button.textContent?.includes('افزودن محصول'))
    ?.dispatchEvent(new Event('click'));
}

/** Which dialog components were opened, in order. */
function openedDialogs(openSpy: ReturnType<typeof answerDialogs>): unknown[] {
  return openSpy.mock.calls.map(([component]) => component);
}

/** Forces the tick a follow-up fetch (a retry, or a dialog-triggered reload) needs to dispatch. */
function tick(): void {
  TestBed.inject(ApplicationRef).tick();
}

/** Opens a row's «عملیات بیشتر» menu — where copying the id and deleting live. */
function openRowMenu(root: HTMLElement, name: string): void {
  root
    .querySelector<HTMLButtonElement>(`[aria-label="عملیات بیشتر برای ${name}"]`)
    ?.dispatchEvent(new Event('click'));
  tick();
}

function menuItem(text: string): HTMLElement | undefined {
  return Array.from(document.body.querySelectorAll<HTMLElement>('[role="menuitem"]')).find(
    (item) => item.textContent?.trim() === text,
  );
}

function chooseRowAction(root: HTMLElement, name: string, action: string): void {
  openRowMenu(root, name);
  menuItem(action)?.dispatchEvent(new Event('click'));
}

/**
 * `Clipboard.copy` reaches for `document.execCommand`, which jsdom does not implement, and the
 * snackbar that confirms the copy would attach a real overlay. Both are stubbed so the assertion is
 * about what the row asked to copy.
 */
function stubClipboard() {
  vi.spyOn(TestBed.inject(MatSnackBar), 'open').mockReturnValue(
    {} as MatSnackBarRef<TextOnlySnackBar>,
  );
  vi.spyOn(TestBed.inject(MatSnackBar), 'openFromComponent').mockReturnValue(
    {} as MatSnackBarRef<unknown>,
  );

  return vi.spyOn(TestBed.inject(Clipboard), 'copy').mockReturnValue(true);
}

describe('ProductsPage', () => {
  afterEach(() => {
    TestBed.inject(HttpTestingController).verify();
  });

  it('opens with the page title as its one level-one heading and the list as a named region', async () => {
    const { fixture, httpMock, root } = setUp();
    httpMock.expectOne({ method: 'GET', url: '/api/products' }).flush(products);
    await fixture.whenStable();

    expect(root.querySelectorAll('h1')).toHaveLength(1);
    expect(root.querySelector('h1')?.textContent?.trim()).toBe('مدیریت محصولات');
    const sheet = root.querySelector('section[aria-labelledby]');
    expect(root.querySelector(`#${sheet?.getAttribute('aria-labelledby')}`)?.textContent).toBe(
      'فهرست محصولات',
    );
    expect(root.querySelector('[role="status"]')?.textContent?.trim()).toBe('۲ نتیجه');
  });

  it('narrows the list as the visitor types in the search box, in Persian or Arabic letters', async () => {
    const { fixture, httpMock, root } = setUp();
    httpMock.expectOne({ method: 'GET', url: '/api/products' }).flush(products);
    await fixture.whenStable();

    const search = root.querySelector<HTMLInputElement>('input[type="search"]')!;
    search.value = 'گجت';
    search.dispatchEvent(new Event('input'));
    await fixture.whenStable();

    const rows = Array.from(root.querySelectorAll('tr[mat-row]')).map((row) =>
      row.textContent?.trim(),
    );
    expect(rows).toHaveLength(1);
    expect(rows[0]).toContain('گجت');
    expect(root.querySelector('[role="status"]')?.textContent?.trim()).toBe('۱ نتیجه');
  });

  it('says nothing matched and offers to clear the search', async () => {
    const { fixture, httpMock, root } = setUp();
    httpMock.expectOne({ method: 'GET', url: '/api/products' }).flush(products);
    await fixture.whenStable();

    const search = root.querySelector<HTMLInputElement>('input[type="search"]')!;
    search.value = 'چیزی که نیست';
    search.dispatchEvent(new Event('input'));
    await fixture.whenStable();

    expect(root.textContent).toContain('موردی یافت نشد');
    const clear = Array.from(root.querySelectorAll('button')).find(
      (button) => button.textContent?.trim() === 'پاک کردن جستجو',
    );
    clear?.dispatchEvent(new Event('click'));
    await fixture.whenStable();

    expect(root.querySelectorAll('tr[mat-row]')).toHaveLength(2);
  });

  it('shows a loading indicator before the list arrives', () => {
    const { httpMock, root } = setUp();

    expect(root.querySelector('mat-progress-bar')).not.toBeNull();

    httpMock.expectOne({ method: 'GET', url: '/api/products' }).flush([]);
  });

  it('renders every product', async () => {
    const { fixture, httpMock, root } = setUp();

    httpMock.expectOne({ method: 'GET', url: '/api/products' }).flush(products);
    await fixture.whenStable();

    expect(root.textContent).toContain('ویجت');
    expect(root.textContent).toContain('گجت');
  });

  it('shows an empty-state message when nothing is registered', async () => {
    const { fixture, httpMock, root } = setUp();

    httpMock.expectOne({ method: 'GET', url: '/api/products' }).flush([]);
    await fixture.whenStable();

    expect(root.textContent).toContain('هیچ محصولی ثبت نشده است');
  });

  it('shows an access-denied message, not a generic error, on a 403', async () => {
    const { fixture, httpMock, root } = setUp();

    httpMock
      .expectOne({ method: 'GET', url: '/api/products' })
      .flush({ title: 'Forbidden' }, { status: 403, statusText: 'Forbidden' });
    await fixture.whenStable();

    const alert = root.querySelector('[role="alert"]');
    expect(alert?.textContent).toContain('دسترسی');
    expect(root.querySelector('table')).toBeNull();
  });

  it('shows a generic error with a retry action for anything else', async () => {
    const { fixture, httpMock, root } = setUp();

    httpMock
      .expectOne({ method: 'GET', url: '/api/products' })
      .flush(null, { status: 500, statusText: 'Internal Server Error' });
    await fixture.whenStable();

    const retry = Array.from(root.querySelectorAll('button')).find((button) =>
      button.textContent?.includes('تلاش دوباره'),
    );
    expect(retry).toBeDefined();

    retry?.dispatchEvent(new Event('click'));
    tick();
    httpMock.expectOne({ method: 'GET', url: '/api/products' }).flush(products);
    await fixture.whenStable();

    expect(root.textContent).toContain('ویجت');
  });

  it('opens the create dialog and reloads the list once a product is registered', async () => {
    const { fixture, httpMock, root } = setUp();
    httpMock.expectOne({ method: 'GET', url: '/api/products' }).flush([]);
    await fixture.whenStable();

    const openSpy = answerDialogs(new Map([[ProductFormDialog, registeredProduct]]));

    clickAddProduct(root);
    tick();

    expect(openSpy).toHaveBeenCalledWith(ProductFormDialog, {
      data: { mode: 'create', components: registeredComponents, materials: registeredMaterials },
    });

    httpMock.expectOne({ method: 'GET', url: '/api/products' }).flush(products);
    await fixture.whenStable();

    expect(root.textContent).toContain('ویجت');
  });

  describe('offering a standard BOM for the product just registered (issue #128)', () => {
    beforeEach(() => localStorage.clear());

    it('asks once a role that manages standard BOMs registers a product', async () => {
      const { fixture, httpMock, root } = await setUpAs(Role.management);
      httpMock.expectOne({ method: 'GET', url: '/api/products' }).flush([]);
      await fixture.whenStable();
      const openSpy = answerDialogs(
        new Map<unknown, unknown>([
          [ProductFormDialog, registeredProduct],
          [OfferStandardBomDialog, false],
        ]),
      );

      clickAddProduct(root);
      tick();
      httpMock.expectOne({ method: 'GET', url: '/api/products' }).flush(products);
      await fixture.whenStable();

      expect(openedDialogs(openSpy)).toEqual([ProductFormDialog, OfferStandardBomDialog]);
    });

    it('opens the standard BOM form with the new product locked when accepted', async () => {
      const { fixture, httpMock, root } = await setUpAs(Role.system_admin);
      httpMock.expectOne({ method: 'GET', url: '/api/products' }).flush([]);
      await fixture.whenStable();
      const openSpy = answerDialogs(
        new Map<unknown, unknown>([
          [ProductFormDialog, registeredProduct],
          [OfferStandardBomDialog, true],
          [StandardBomFormDialog, undefined],
        ]),
      );

      clickAddProduct(root);
      tick();
      httpMock.expectOne({ method: 'GET', url: '/api/products' }).flush(products);
      await fixture.whenStable();

      expect(openSpy).toHaveBeenCalledWith(StandardBomFormDialog, {
        data: {
          mode: 'create',
          products: [registeredProduct],
          lockedProductId: registeredProduct.id,
        },
      });
    });

    it('opens nothing more when declined', async () => {
      const { fixture, httpMock, root } = await setUpAs(Role.system_admin);
      httpMock.expectOne({ method: 'GET', url: '/api/products' }).flush([]);
      await fixture.whenStable();
      const openSpy = answerDialogs(
        new Map<unknown, unknown>([
          [ProductFormDialog, registeredProduct],
          [OfferStandardBomDialog, false],
        ]),
      );

      clickAddProduct(root);
      tick();
      httpMock.expectOne({ method: 'GET', url: '/api/products' }).flush(products);
      await fixture.whenStable();

      expect(openedDialogs(openSpy)).toEqual([ProductFormDialog, OfferStandardBomDialog]);
    });

    it('opens nothing more when dismissed with Escape', async () => {
      const { fixture, httpMock, root } = await setUpAs(Role.system_admin);
      httpMock.expectOne({ method: 'GET', url: '/api/products' }).flush([]);
      await fixture.whenStable();
      const openSpy = answerDialogs(
        new Map<unknown, unknown>([
          [ProductFormDialog, registeredProduct],
          [OfferStandardBomDialog, undefined],
        ]),
      );

      clickAddProduct(root);
      tick();
      httpMock.expectOne({ method: 'GET', url: '/api/products' }).flush(products);
      await fixture.whenStable();

      expect(openedDialogs(openSpy)).toEqual([ProductFormDialog, OfferStandardBomDialog]);
    });

    it('does not ask a role that cannot manage standard BOMs', async () => {
      const { fixture, httpMock, root } = await setUpAs(Role.qc_inspector);
      httpMock.expectOne({ method: 'GET', url: '/api/products' }).flush([]);
      await fixture.whenStable();
      const openSpy = answerDialogs(new Map([[ProductFormDialog, registeredProduct]]));

      clickAddProduct(root);
      tick();
      httpMock.expectOne({ method: 'GET', url: '/api/products' }).flush(products);
      await fixture.whenStable();

      expect(openedDialogs(openSpy)).toEqual([ProductFormDialog]);
    });

    it('does not ask when the product form was cancelled', async () => {
      const { fixture, httpMock, root } = await setUpAs(Role.system_admin);
      httpMock.expectOne({ method: 'GET', url: '/api/products' }).flush([]);
      await fixture.whenStable();
      const openSpy = answerDialogs(new Map([[ProductFormDialog, undefined]]));

      clickAddProduct(root);
      tick();
      await fixture.whenStable();

      expect(openedDialogs(openSpy)).toEqual([ProductFormDialog]);
    });

    it('does not ask after an edit', async () => {
      const { fixture, httpMock, root } = await setUpAs(Role.system_admin);
      httpMock.expectOne({ method: 'GET', url: '/api/products' }).flush(products);
      await fixture.whenStable();
      const openSpy = answerDialogs(new Map<unknown, unknown>([[ProductFormDialog, true]]));

      root
        .querySelector<HTMLButtonElement>('[aria-label="ویرایش ویجت"]')
        ?.dispatchEvent(new Event('click'));
      tick();
      httpMock.expectOne({ method: 'GET', url: '/api/products' }).flush(products);
      await fixture.whenStable();

      expect(openedDialogs(openSpy)).toEqual([ProductFormDialog]);
    });
  });

  describe('«تعریف محصول مشابه» (issue #133)', () => {
    beforeEach(() => localStorage.clear());

    it('opens the create form pre-filled from the row it was chosen on, focus returning to the row menu', async () => {
      const { fixture, httpMock, root } = setUp();
      httpMock.expectOne({ method: 'GET', url: '/api/products' }).flush(products);
      await fixture.whenStable();
      const openSpy = answerDialogs(new Map());

      chooseRowAction(root, 'ویجت', 'تعریف محصول مشابه');

      expect(openSpy).toHaveBeenCalledWith(ProductFormDialog, {
        data: {
          mode: 'create',
          source: products[0],
          components: registeredComponents,
          materials: registeredMaterials,
        },
        restoreFocus: root.querySelector('[aria-label="عملیات بیشتر برای ویجت"]'),
      });
    });

    it('registers the copy like any new product: the list reloads and its standard BOM is offered', async () => {
      const { fixture, httpMock, root } = await setUpAs(Role.management);
      httpMock.expectOne({ method: 'GET', url: '/api/products' }).flush(products);
      await fixture.whenStable();
      const openSpy = answerDialogs(
        new Map<unknown, unknown>([
          [ProductFormDialog, registeredProduct],
          [OfferStandardBomDialog, false],
        ]),
      );

      chooseRowAction(root, 'ویجت', 'تعریف محصول مشابه');
      tick();
      httpMock
        .expectOne({ method: 'GET', url: '/api/products' })
        .flush([...products, registeredProduct]);
      await fixture.whenStable();

      expect(openedDialogs(openSpy)).toEqual([ProductFormDialog, OfferStandardBomDialog]);
      expect(root.textContent).toContain('کابل تازه');
    });

    it('registers nothing and reloads nothing when the form is cancelled', async () => {
      const { fixture, httpMock, root } = setUp();
      httpMock.expectOne({ method: 'GET', url: '/api/products' }).flush(products);
      await fixture.whenStable();
      const openSpy = answerDialogs(new Map([[ProductFormDialog, undefined]]));

      chooseRowAction(root, 'ویجت', 'تعریف محصول مشابه');
      tick();
      await fixture.whenStable();

      expect(openedDialogs(openSpy)).toEqual([ProductFormDialog]);
      httpMock.expectNone({ method: 'GET', url: '/api/products' });
    });
  });

  it('opens the edit dialog for the row it was clicked on', async () => {
    const { fixture, httpMock, root } = setUp();
    httpMock.expectOne({ method: 'GET', url: '/api/products' }).flush(products);
    await fixture.whenStable();

    const dialog = TestBed.inject(MatDialog);
    const openSpy = vi
      .spyOn(dialog, 'open')
      .mockReturnValue({ afterClosed: () => of(false) } as MatDialogRef<unknown, boolean>);

    const editButton = root.querySelector<HTMLButtonElement>('[aria-label="ویرایش ویجت"]');
    editButton?.dispatchEvent(new Event('click'));

    expect(openSpy).toHaveBeenCalledWith(ProductFormDialog, {
      data: {
        mode: 'edit',
        product: products[0],
        components: registeredComponents,
        materials: registeredMaterials,
      },
    });
  });

  it('opens the delete dialog for the row it was clicked on', async () => {
    const { fixture, httpMock, root } = setUp();
    httpMock.expectOne({ method: 'GET', url: '/api/products' }).flush(products);
    await fixture.whenStable();

    const dialog = TestBed.inject(MatDialog);
    const openSpy = vi
      .spyOn(dialog, 'open')
      .mockReturnValue({ afterClosed: () => of(false) } as MatDialogRef<unknown, boolean>);

    chooseRowAction(root, 'ویجت', 'حذف');

    expect(openSpy).toHaveBeenCalledWith(ConfirmDeleteProductDialog, {
      data: { product: products[0] },
    });
  });

  it('copies a row id to the clipboard, naming the row it came from', async () => {
    const { fixture, httpMock, root } = setUp();
    httpMock.expectOne({ method: 'GET', url: '/api/products' }).flush(products);
    await fixture.whenStable();

    const copy = stubClipboard();

    chooseRowAction(root, 'گجت', 'کپی شناسه');

    expect(copy).toHaveBeenCalledWith(products[1].id);
  });
});
