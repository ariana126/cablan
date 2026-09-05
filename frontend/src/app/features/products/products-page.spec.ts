import { Clipboard } from '@angular/cdk/clipboard';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ApplicationRef } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { MatDialog, MatDialogRef } from '@angular/material/dialog';
import { MatSnackBar, MatSnackBarRef, TextOnlySnackBar } from '@angular/material/snack-bar';
import { provideRouter } from '@angular/router';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { ConfirmDeleteProductDialog } from './confirm-delete-product-dialog';
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
const registeredMaterials = [{ id: 'm1', name: 'میلگرد فولادی' }];

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

/** Forces the tick a follow-up fetch (a retry, or a dialog-triggered reload) needs to dispatch. */
function tick(): void {
  TestBed.inject(ApplicationRef).tick();
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

  return vi.spyOn(TestBed.inject(Clipboard), 'copy').mockReturnValue(true);
}

describe('ProductsPage', () => {
  afterEach(() => {
    TestBed.inject(HttpTestingController).verify();
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

    const dialog = TestBed.inject(MatDialog);
    const openSpy = vi
      .spyOn(dialog, 'open')
      .mockReturnValue({ afterClosed: () => of(true) } as MatDialogRef<unknown, boolean>);

    const addButton = Array.from(root.querySelectorAll('button')).find((button) =>
      button.textContent?.includes('افزودن محصول'),
    );
    addButton?.dispatchEvent(new Event('click'));
    tick();

    expect(openSpy).toHaveBeenCalledWith(ProductFormDialog, {
      data: { mode: 'create', components: registeredComponents, materials: registeredMaterials },
    });

    httpMock.expectOne({ method: 'GET', url: '/api/products' }).flush(products);
    await fixture.whenStable();

    expect(root.textContent).toContain('ویجت');
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

    const deleteButton = root.querySelector<HTMLButtonElement>('[aria-label="حذف ویجت"]');
    deleteButton?.dispatchEvent(new Event('click'));

    expect(openSpy).toHaveBeenCalledWith(ConfirmDeleteProductDialog, {
      data: { product: products[0] },
    });
  });

  it('copies a row id to the clipboard, naming the row it came from', async () => {
    const { fixture, httpMock, root } = setUp();
    httpMock.expectOne({ method: 'GET', url: '/api/products' }).flush(products);
    await fixture.whenStable();

    const copy = stubClipboard();

    root
      .querySelector<HTMLButtonElement>('[aria-label="کپی شناسه گجت"]')
      ?.dispatchEvent(new Event('click'));

    expect(copy).toHaveBeenCalledWith(products[1].id);
  });
});
