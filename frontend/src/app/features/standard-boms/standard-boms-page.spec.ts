import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ApplicationRef } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { MatDialog, MatDialogRef } from '@angular/material/dialog';
import { provideRouter, Router } from '@angular/router';
import { of } from 'rxjs';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { SessionStore } from '../../core/identity/session-store';
import { ConfirmDeleteStandardBomDialog } from './confirm-delete-standard-bom-dialog';
import { StandardBomFormDialog } from './standard-bom-form-dialog';
import { StandardBomsPage } from './standard-boms-page';

const products = [{ id: 'product-1', name: 'کابل شبکه U/UTP 0.42 LEGRAND', components: [] }];

const standardBoms = [
  {
    id: 'bom-1',
    miCode: '1234',
    brand: 'Legrand',
    standardLength: 305,
    active: true,
    description: '',
    productId: 'product-1',
    components: [],
  },
  {
    id: 'bom-2',
    miCode: '5678',
    brand: 'Schneider',
    standardLength: 500,
    active: false,
    description: '',
    productId: 'product-1',
    components: [],
  },
];

/**
 * Creates the page and forces one synchronous tick so both resources' initial requests are actually
 * dispatched — `whenStable()` cannot be used here, since the very requests it would wait on are what
 * the test leaves deliberately unflushed until it gets to assert on them.
 */
function setUp() {
  TestBed.configureTestingModule({
    providers: [provideHttpClient(), provideHttpClientTesting(), provideRouter([])],
  });

  const fixture = TestBed.createComponent(StandardBomsPage);
  TestBed.inject(ApplicationRef).tick();

  return {
    fixture,
    httpMock: TestBed.inject(HttpTestingController),
    root: fixture.nativeElement as HTMLElement,
  };
}

function tick(): void {
  TestBed.inject(ApplicationRef).tick();
}

function flushBoth(httpMock: HttpTestingController): void {
  httpMock.expectOne({ method: 'GET', url: '/api/products' }).flush(products);
  httpMock.expectOne({ method: 'GET', url: '/api/standard-boms' }).flush(standardBoms);
}

describe('StandardBomsPage', () => {
  afterEach(() => {
    TestBed.inject(HttpTestingController).verify();
  });

  it('shows a loading indicator before the lists arrive', () => {
    const { httpMock, root } = setUp();

    expect(root.querySelector('mat-progress-bar')).not.toBeNull();

    flushBoth(httpMock);
  });

  it('renders every standard BOM, with its product name resolved', async () => {
    const { fixture, httpMock, root } = setUp();

    flushBoth(httpMock);
    await fixture.whenStable();

    expect(root.textContent).toContain('1234');
    expect(root.textContent).toContain('5678');
    expect(root.textContent).toContain('کابل شبکه U/UTP 0.42 LEGRAND');
  });

  it('shows an empty-state message when nothing is registered', async () => {
    const { fixture, httpMock, root } = setUp();

    httpMock.expectOne({ method: 'GET', url: '/api/products' }).flush(products);
    httpMock.expectOne({ method: 'GET', url: '/api/standard-boms' }).flush([]);
    await fixture.whenStable();

    expect(root.textContent).toContain('هیچ آنالیز استانداردی ثبت نشده است');
  });

  it('shows an access-denied message, not a generic error, on a 403 from the standard BOM list', async () => {
    const { fixture, httpMock, root } = setUp();

    httpMock.expectOne({ method: 'GET', url: '/api/products' }).flush(products);
    httpMock
      .expectOne({ method: 'GET', url: '/api/standard-boms' })
      .flush({ title: 'Forbidden' }, { status: 403, statusText: 'Forbidden' });
    await fixture.whenStable();

    const alert = root.querySelector('[role="alert"]');
    expect(alert?.textContent).toContain('دسترسی');
    expect(root.querySelector('table')).toBeNull();
  });

  it('opens the create dialog and reloads the list once a standard BOM is registered', async () => {
    const { fixture, httpMock, root } = setUp();
    httpMock.expectOne({ method: 'GET', url: '/api/products' }).flush(products);
    httpMock.expectOne({ method: 'GET', url: '/api/standard-boms' }).flush([]);
    await fixture.whenStable();

    const dialog = TestBed.inject(MatDialog);
    const openSpy = vi
      .spyOn(dialog, 'open')
      .mockReturnValue({ afterClosed: () => of(true) } as MatDialogRef<unknown, boolean>);

    const addButton = Array.from(root.querySelectorAll('button')).find((button) =>
      button.textContent?.includes('افزودن آنالیز استاندارد'),
    );
    addButton?.dispatchEvent(new Event('click'));
    tick();

    expect(openSpy).toHaveBeenCalledWith(StandardBomFormDialog, {
      data: { mode: 'create', products },
    });

    httpMock.expectOne({ method: 'GET', url: '/api/standard-boms' }).flush(standardBoms);
    await fixture.whenStable();

    expect(root.textContent).toContain('1234');
  });

  it('opens the edit dialog for the row it was clicked on', async () => {
    const { fixture, httpMock, root } = setUp();
    flushBoth(httpMock);
    await fixture.whenStable();

    const dialog = TestBed.inject(MatDialog);
    const openSpy = vi
      .spyOn(dialog, 'open')
      .mockReturnValue({ afterClosed: () => of(false) } as MatDialogRef<unknown, boolean>);

    const editButton = root.querySelector<HTMLButtonElement>('[aria-label="ویرایش 1234"]');
    editButton?.dispatchEvent(new Event('click'));

    expect(openSpy).toHaveBeenCalledWith(StandardBomFormDialog, {
      data: { mode: 'edit', standardBom: standardBoms[0], products },
    });
  });

  it('opens the delete dialog for the row it was clicked on', async () => {
    const { fixture, httpMock, root } = setUp();
    flushBoth(httpMock);
    await fixture.whenStable();

    const dialog = TestBed.inject(MatDialog);
    const openSpy = vi
      .spyOn(dialog, 'open')
      .mockReturnValue({ afterClosed: () => of(false) } as MatDialogRef<unknown, boolean>);

    const deleteButton = root.querySelector<HTMLButtonElement>('[aria-label="حذف 1234"]');
    deleteButton?.dispatchEvent(new Event('click'));

    expect(openSpy).toHaveBeenCalledWith(ConfirmDeleteStandardBomDialog, {
      data: { standardBom: standardBoms[0] },
    });
  });

  it('has a logout button that clears the session and navigates to the login page', async () => {
    const { fixture, httpMock, root } = setUp();
    flushBoth(httpMock);
    await fixture.whenStable();

    const session = TestBed.inject(SessionStore);
    session.store('a-token');
    const router = TestBed.inject(Router);
    const navigateSpy = vi.spyOn(router, 'navigateByUrl').mockResolvedValue(true);

    const logoutButton = Array.from(root.querySelectorAll('button')).find(
      (button) => button.textContent?.trim() === 'خروج از سیستم',
    );
    logoutButton?.dispatchEvent(new Event('click'));

    expect(session.isAuthenticated()).toBe(false);
    expect(navigateSpy).toHaveBeenCalledWith('/login');
  });
});
