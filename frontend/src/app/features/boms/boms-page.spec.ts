import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ApplicationRef } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { MatDialog, MatDialogRef } from '@angular/material/dialog';
import { provideRouter, Router } from '@angular/router';
import { of } from 'rxjs';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { SessionStore } from '../../core/identity/session-store';
import { BomFormDialog } from './bom-form-dialog';
import { BomsPage } from './boms-page';
import { ConfirmDeleteBomDialog } from './confirm-delete-bom-dialog';

const standardBoms = [
  {
    id: 'standard-bom-1',
    miCode: '0001',
    brand: 'Legrand',
    standardLength: 305,
    active: true,
    description: '',
    productId: 'product-1',
    components: [],
  },
];

const boms = [
  {
    id: 'bom-1',
    standardBomId: 'standard-bom-1',
    orderNumber: 'SO-1234',
    trackingNumber: 'TN-5678',
    description: '',
    components: [],
  },
  {
    id: 'bom-2',
    standardBomId: 'standard-bom-1',
    orderNumber: 'SO-9999',
    trackingNumber: 'TN-0000',
    description: '',
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

  const fixture = TestBed.createComponent(BomsPage);
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
  httpMock.expectOne({ method: 'GET', url: '/api/standard-boms' }).flush(standardBoms);
  httpMock.expectOne({ method: 'GET', url: '/api/boms' }).flush(boms);
}

describe('BomsPage', () => {
  afterEach(() => {
    TestBed.inject(HttpTestingController).verify();
  });

  it('shows a loading indicator before the lists arrive', () => {
    const { httpMock, root } = setUp();

    expect(root.querySelector('mat-progress-bar')).not.toBeNull();

    flushBoth(httpMock);
  });

  it('renders every daily BOM, with its standard BOM MI code resolved', async () => {
    const { fixture, httpMock, root } = setUp();

    flushBoth(httpMock);
    await fixture.whenStable();

    expect(root.textContent).toContain('SO-1234');
    expect(root.textContent).toContain('SO-9999');
    expect(root.textContent).toContain('0001');
  });

  it('shows an empty-state message when nothing is registered', async () => {
    const { fixture, httpMock, root } = setUp();

    httpMock.expectOne({ method: 'GET', url: '/api/standard-boms' }).flush(standardBoms);
    httpMock.expectOne({ method: 'GET', url: '/api/boms' }).flush([]);
    await fixture.whenStable();

    expect(root.textContent).toContain('هیچ آنالیز روزانه‌ای ثبت نشده است');
  });

  it('shows a generic error and a retry button when the list fails to load', async () => {
    const { fixture, httpMock, root } = setUp();

    httpMock.expectOne({ method: 'GET', url: '/api/standard-boms' }).flush(standardBoms);
    httpMock
      .expectOne({ method: 'GET', url: '/api/boms' })
      .flush({ title: 'Internal Server Error' }, { status: 500, statusText: 'Server Error' });
    await fixture.whenStable();

    const alert = root.querySelector('[role="alert"]');
    expect(alert?.textContent).toContain('بارگذاری نشد');
    expect(root.querySelector('table')).toBeNull();
  });

  it('opens the create dialog and reloads the list once a daily BOM is registered', async () => {
    const { fixture, httpMock, root } = setUp();
    httpMock.expectOne({ method: 'GET', url: '/api/standard-boms' }).flush(standardBoms);
    httpMock.expectOne({ method: 'GET', url: '/api/boms' }).flush([]);
    await fixture.whenStable();

    const dialog = TestBed.inject(MatDialog);
    const openSpy = vi
      .spyOn(dialog, 'open')
      .mockReturnValue({ afterClosed: () => of(true) } as MatDialogRef<unknown, boolean>);

    const addButton = Array.from(root.querySelectorAll('button')).find((button) =>
      button.textContent?.includes('افزودن آنالیز روزانه'),
    );
    addButton?.dispatchEvent(new Event('click'));
    tick();

    expect(openSpy).toHaveBeenCalledWith(BomFormDialog, {
      data: { mode: 'create', standardBoms },
    });

    httpMock.expectOne({ method: 'GET', url: '/api/boms' }).flush(boms);
    await fixture.whenStable();

    expect(root.textContent).toContain('SO-1234');
  });

  it('opens the edit dialog for the row it was clicked on', async () => {
    const { fixture, httpMock, root } = setUp();
    flushBoth(httpMock);
    await fixture.whenStable();

    const dialog = TestBed.inject(MatDialog);
    const openSpy = vi
      .spyOn(dialog, 'open')
      .mockReturnValue({ afterClosed: () => of(false) } as MatDialogRef<unknown, boolean>);

    const editButton = root.querySelector<HTMLButtonElement>('[aria-label="ویرایش SO-1234"]');
    editButton?.dispatchEvent(new Event('click'));

    expect(openSpy).toHaveBeenCalledWith(BomFormDialog, {
      data: { mode: 'edit', bom: boms[0], standardBoms },
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

    const deleteButton = root.querySelector<HTMLButtonElement>('[aria-label="حذف SO-1234"]');
    deleteButton?.dispatchEvent(new Event('click'));

    expect(openSpy).toHaveBeenCalledWith(ConfirmDeleteBomDialog, {
      data: { bom: boms[0] },
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
