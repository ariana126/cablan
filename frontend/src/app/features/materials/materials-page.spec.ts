import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ApplicationRef } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { MatDialog, MatDialogRef } from '@angular/material/dialog';
import { provideRouter, Router } from '@angular/router';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { SessionStore } from '../../core/identity/session-store';
import { ConfirmDeleteMaterialDialog } from './confirm-delete-material-dialog';
import { MaterialFormDialog } from './material-form-dialog';
import { MaterialsPage } from './materials-page';

const materials = [
  { id: '1', name: 'میلگرد فولادی' },
  { id: '2', name: 'ورق آلومینیوم' },
];

/**
 * Creates the page and forces one synchronous tick so the resource's initial request is actually
 * dispatched — `whenStable()` cannot be used for this part, because the very request it would be
 * waiting on is what is left deliberately unflushed until the test gets to assert on it.
 */
function setUp() {
  TestBed.configureTestingModule({
    providers: [provideHttpClient(), provideHttpClientTesting(), provideRouter([])],
  });

  const fixture = TestBed.createComponent(MaterialsPage);
  TestBed.inject(ApplicationRef).tick();

  return {
    fixture,
    httpMock: TestBed.inject(HttpTestingController),
    root: fixture.nativeElement as HTMLElement,
  };
}

/** Forces the tick a follow-up fetch (a retry, or a dialog-triggered reload) needs to dispatch. */
function tick(): void {
  TestBed.inject(ApplicationRef).tick();
}

describe('MaterialsPage', () => {
  afterEach(() => {
    TestBed.inject(HttpTestingController).verify();
  });

  it('shows a loading indicator before the list arrives', () => {
    const { httpMock, root } = setUp();

    expect(root.querySelector('mat-progress-bar')).not.toBeNull();

    httpMock.expectOne({ method: 'GET', url: '/api/materials' }).flush([]);
  });

  it('renders every material', async () => {
    const { fixture, httpMock, root } = setUp();

    httpMock.expectOne({ method: 'GET', url: '/api/materials' }).flush(materials);
    await fixture.whenStable();

    expect(root.textContent).toContain('میلگرد فولادی');
    expect(root.textContent).toContain('ورق آلومینیوم');
  });

  it('shows an empty-state message when nothing is registered', async () => {
    const { fixture, httpMock, root } = setUp();

    httpMock.expectOne({ method: 'GET', url: '/api/materials' }).flush([]);
    await fixture.whenStable();

    expect(root.textContent).toContain('هیچ مادهٔ اولیه‌ای ثبت نشده است');
  });

  it('shows an access-denied message, not a generic error, on a 403', async () => {
    const { fixture, httpMock, root } = setUp();

    httpMock
      .expectOne({ method: 'GET', url: '/api/materials' })
      .flush({ title: 'Forbidden' }, { status: 403, statusText: 'Forbidden' });
    await fixture.whenStable();

    const alert = root.querySelector('[role="alert"]');
    expect(alert?.textContent).toContain('دسترسی');
    expect(root.querySelector('table')).toBeNull();
  });

  it('shows a generic error with a retry action for anything else', async () => {
    const { fixture, httpMock, root } = setUp();

    httpMock
      .expectOne({ method: 'GET', url: '/api/materials' })
      .flush(null, { status: 500, statusText: 'Internal Server Error' });
    await fixture.whenStable();

    const retry = Array.from(root.querySelectorAll('button')).find((button) =>
      button.textContent?.includes('تلاش دوباره'),
    );
    expect(retry).toBeDefined();

    retry?.dispatchEvent(new Event('click'));
    tick();
    httpMock.expectOne({ method: 'GET', url: '/api/materials' }).flush(materials);
    await fixture.whenStable();

    expect(root.textContent).toContain('میلگرد فولادی');
  });

  it('opens the create dialog and reloads the list once a material is registered', async () => {
    const { fixture, httpMock, root } = setUp();
    httpMock.expectOne({ method: 'GET', url: '/api/materials' }).flush([]);
    await fixture.whenStable();

    const dialog = TestBed.inject(MatDialog);
    const openSpy = vi
      .spyOn(dialog, 'open')
      .mockReturnValue({ afterClosed: () => of(true) } as MatDialogRef<unknown, boolean>);

    const addButton = Array.from(root.querySelectorAll('button')).find((button) =>
      button.textContent?.includes('افزودن مواد اولیه'),
    );
    addButton?.dispatchEvent(new Event('click'));
    tick();

    expect(openSpy).toHaveBeenCalledWith(MaterialFormDialog, { data: { mode: 'create' } });

    httpMock.expectOne({ method: 'GET', url: '/api/materials' }).flush(materials);
    await fixture.whenStable();

    expect(root.textContent).toContain('میلگرد فولادی');
  });

  it('opens the edit dialog for the row it was clicked on', async () => {
    const { fixture, httpMock, root } = setUp();
    httpMock.expectOne({ method: 'GET', url: '/api/materials' }).flush(materials);
    await fixture.whenStable();

    const dialog = TestBed.inject(MatDialog);
    const openSpy = vi
      .spyOn(dialog, 'open')
      .mockReturnValue({ afterClosed: () => of(false) } as MatDialogRef<unknown, boolean>);

    const editButton = root.querySelector<HTMLButtonElement>('[aria-label="ویرایش میلگرد فولادی"]');
    editButton?.dispatchEvent(new Event('click'));

    expect(openSpy).toHaveBeenCalledWith(MaterialFormDialog, {
      data: { mode: 'edit', material: materials[0] },
    });
  });

  it('opens the delete dialog for the row it was clicked on', async () => {
    const { fixture, httpMock, root } = setUp();
    httpMock.expectOne({ method: 'GET', url: '/api/materials' }).flush(materials);
    await fixture.whenStable();

    const dialog = TestBed.inject(MatDialog);
    const openSpy = vi
      .spyOn(dialog, 'open')
      .mockReturnValue({ afterClosed: () => of(false) } as MatDialogRef<unknown, boolean>);

    const deleteButton = root.querySelector<HTMLButtonElement>('[aria-label="حذف میلگرد فولادی"]');
    deleteButton?.dispatchEvent(new Event('click'));

    expect(openSpy).toHaveBeenCalledWith(ConfirmDeleteMaterialDialog, {
      data: { material: materials[0] },
    });
  });

  it('has a logout button that clears the session and navigates to the login page', async () => {
    const { fixture, httpMock, root } = setUp();
    httpMock.expectOne({ method: 'GET', url: '/api/materials' }).flush([]);
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
