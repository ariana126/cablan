import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ApplicationRef } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { MatDialog, MatDialogRef } from '@angular/material/dialog';
import { provideRouter } from '@angular/router';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { Role } from '../../api/model';
import { ConfirmDeleteUserDialog } from './confirm-delete-user-dialog';
import { UserFormDialog } from './user-form-dialog';
import { UsersPage } from './users-page';

const users = [
  { id: '1', name: 'Sina Ghadrdan', username: 'sina.q', role: Role.qc_inspector },
  { id: '2', name: 'Yashar', username: 'yashar', role: Role.system_admin },
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

  const fixture = TestBed.createComponent(UsersPage);
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

describe('UsersPage', () => {
  afterEach(() => {
    TestBed.inject(HttpTestingController).verify();
  });

  it('shows a loading indicator before the list arrives', () => {
    const { httpMock, root } = setUp();

    expect(root.querySelector('mat-progress-bar')).not.toBeNull();

    httpMock.expectOne({ method: 'GET', url: '/api/users' }).flush([]);
  });

  it('renders every user, with a Persian label for the role', async () => {
    const { fixture, httpMock, root } = setUp();

    httpMock.expectOne({ method: 'GET', url: '/api/users' }).flush(users);
    await fixture.whenStable();

    expect(root.textContent).toContain('Sina Ghadrdan');
    expect(root.textContent).toContain('sina.q');
    expect(root.textContent).toContain('بازرس کنترل کیفیت');
    expect(root.textContent).toContain('مدیر سیستم');
  });

  it('shows an empty-state message when nobody is registered', async () => {
    const { fixture, httpMock, root } = setUp();

    httpMock.expectOne({ method: 'GET', url: '/api/users' }).flush([]);
    await fixture.whenStable();

    expect(root.textContent).toContain('هیچ کاربری ثبت نشده است');
  });

  it('shows an access-denied message, not a generic error, on a 403', async () => {
    const { fixture, httpMock, root } = setUp();

    httpMock
      .expectOne({ method: 'GET', url: '/api/users' })
      .flush({ title: 'Forbidden' }, { status: 403, statusText: 'Forbidden' });
    await fixture.whenStable();

    const alert = root.querySelector('[role="alert"]');
    expect(alert?.textContent).toContain('دسترسی');
    expect(root.querySelector('table')).toBeNull();
  });

  it('shows a generic error with a retry action for anything else', async () => {
    const { fixture, httpMock, root } = setUp();

    httpMock
      .expectOne({ method: 'GET', url: '/api/users' })
      .flush(null, { status: 500, statusText: 'Internal Server Error' });
    await fixture.whenStable();

    const retry = Array.from(root.querySelectorAll('button')).find((button) =>
      button.textContent?.includes('تلاش دوباره'),
    );
    expect(retry).toBeDefined();

    retry?.dispatchEvent(new Event('click'));
    tick();
    httpMock.expectOne({ method: 'GET', url: '/api/users' }).flush(users);
    await fixture.whenStable();

    expect(root.textContent).toContain('Sina Ghadrdan');
  });

  it('opens the create dialog and reloads the list once a user is registered', async () => {
    const { fixture, httpMock, root } = setUp();
    httpMock.expectOne({ method: 'GET', url: '/api/users' }).flush([]);
    await fixture.whenStable();

    const dialog = TestBed.inject(MatDialog);
    const openSpy = vi
      .spyOn(dialog, 'open')
      .mockReturnValue({ afterClosed: () => of(true) } as MatDialogRef<unknown, boolean>);

    const addButton = Array.from(root.querySelectorAll('button')).find((button) =>
      button.textContent?.includes('افزودن کاربر جدید'),
    );
    addButton?.dispatchEvent(new Event('click'));
    tick();

    expect(openSpy).toHaveBeenCalledWith(UserFormDialog, { data: { mode: 'create' } });

    httpMock.expectOne({ method: 'GET', url: '/api/users' }).flush(users);
    await fixture.whenStable();

    expect(root.textContent).toContain('Sina Ghadrdan');
  });

  it('opens the edit dialog for the row it was clicked on', async () => {
    const { fixture, httpMock, root } = setUp();
    httpMock.expectOne({ method: 'GET', url: '/api/users' }).flush(users);
    await fixture.whenStable();

    const dialog = TestBed.inject(MatDialog);
    const openSpy = vi
      .spyOn(dialog, 'open')
      .mockReturnValue({ afterClosed: () => of(false) } as MatDialogRef<unknown, boolean>);

    const editButton = root.querySelector<HTMLButtonElement>('[aria-label="ویرایش Sina Ghadrdan"]');
    editButton?.dispatchEvent(new Event('click'));

    expect(openSpy).toHaveBeenCalledWith(UserFormDialog, {
      data: { mode: 'edit', user: users[0] },
    });
  });

  it('opens the delete dialog for the row it was clicked on', async () => {
    const { fixture, httpMock, root } = setUp();
    httpMock.expectOne({ method: 'GET', url: '/api/users' }).flush(users);
    await fixture.whenStable();

    const dialog = TestBed.inject(MatDialog);
    const openSpy = vi
      .spyOn(dialog, 'open')
      .mockReturnValue({ afterClosed: () => of(false) } as MatDialogRef<unknown, boolean>);

    const deleteButton = root.querySelector<HTMLButtonElement>('[aria-label="حذف Sina Ghadrdan"]');
    deleteButton?.dispatchEvent(new Event('click'));

    expect(openSpy).toHaveBeenCalledWith(ConfirmDeleteUserDialog, { data: { user: users[0] } });
  });
});
