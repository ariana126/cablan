import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ApplicationRef } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { MatDialog, MatDialogRef } from '@angular/material/dialog';
import { MatPaginatorIntl } from '@angular/material/paginator';
import { provideRouter, Router } from '@angular/router';
import { of } from 'rxjs';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { PersianPaginatorIntl } from '../../core/material/persian-paginator-intl';
import { SessionStore } from '../../core/identity/session-store';
import { AuditLogChangesDialog } from './audit-log-changes-dialog';
import { AuditLogPage } from './audit-log-page';

const editedEntry = {
  id: '1',
  occurredAt: '2024-06-21T08:30:00.000Z',
  actorName: 'مصطفی',
  recordType: 'StandardBom',
  recordId: '66666666-6666-6666-6666-666666666666',
  action: 'Edited',
};

const registeredEntry = {
  id: '2',
  occurredAt: '2024-06-22T09:00:00.000Z',
  actorName: 'یاشار',
  recordType: 'Bom',
  recordId: '77777777-7777-7777-7777-777777777777',
  action: 'Registered',
};

function setUp() {
  TestBed.configureTestingModule({
    providers: [
      provideHttpClient(),
      provideHttpClientTesting(),
      provideRouter([]),
      { provide: MatPaginatorIntl, useClass: PersianPaginatorIntl },
    ],
  });

  const fixture = TestBed.createComponent(AuditLogPage);
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

function expectListRequest(httpMock: HttpTestingController) {
  return httpMock.expectOne({ method: 'POST', url: '/api/audit-log' });
}

function flushInitial(
  httpMock: HttpTestingController,
  items = [editedEntry, registeredEntry],
  total = 2,
): void {
  expectListRequest(httpMock).flush({ items, total });
}

function findButton(root: HTMLElement, text: string): HTMLButtonElement | undefined {
  return Array.from(root.querySelectorAll('button')).find(
    (button) => button.textContent?.trim() === text,
  );
}

describe('AuditLogPage', () => {
  afterEach(() => {
    TestBed.inject(HttpTestingController).verify();
  });

  it('shows a loading indicator before the log arrives', () => {
    const { httpMock, root } = setUp();

    expect(root.querySelector('mat-progress-bar')).not.toBeNull();

    flushInitial(httpMock);
  });

  it('requests the first page with no filter field at all when none are set', () => {
    const { httpMock } = setUp();

    const request = expectListRequest(httpMock);
    expect(request.request.body).toEqual({ page: 1, pageSize: 20 });

    request.flush({ items: [], total: 0 });
  });

  it('renders every row with translated labels and the occurred-at instant as Jalali text', async () => {
    const { fixture, httpMock, root } = setUp();

    flushInitial(httpMock);
    await fixture.whenStable();

    expect(root.textContent).toContain('مصطفی');
    expect(root.textContent).toContain('آنالیز استاندارد');
    expect(root.textContent).toContain('66666666-6666-6666-6666-666666666666');
    expect(root.textContent).toContain('ویرایش');
    // 2024-06-21T08:30:00Z is 1403/04/01 08:30 in Jalali.
    expect(root.textContent).toContain('1403/04/01 08:30');
  });

  it('shows exactly the five business columns plus the actions column, in order', async () => {
    const { fixture, httpMock, root } = setUp();

    flushInitial(httpMock);
    await fixture.whenStable();

    const headers = Array.from(root.querySelectorAll('th')).map((th) => th.textContent?.trim());
    expect(headers).toEqual([
      'کاربر',
      'تاریخ و زمان',
      'نوع رکورد',
      'شناسه رکورد',
      'نوع رویداد',
      'عملیات',
    ]);
  });

  it('shows an empty-state message when nothing matches', async () => {
    const { fixture, httpMock, root } = setUp();

    flushInitial(httpMock, [], 0);
    await fixture.whenStable();

    expect(root.textContent).toContain('هیچ رویدادی یافت نشد');
  });

  it('shows a generic error and a retry button when the log fails to load', async () => {
    const { fixture, httpMock, root } = setUp();

    expectListRequest(httpMock).flush(
      { title: 'Internal Server Error' },
      { status: 500, statusText: 'Server Error' },
    );
    await fixture.whenStable();

    const alert = root.querySelector('[role="alert"]');
    expect(alert?.textContent).toContain('بارگذاری نشد');
    expect(root.querySelector('table')).toBeNull();

    findButton(root, 'تلاش دوباره')?.dispatchEvent(new Event('click'));
    tick();
    expectListRequest(httpMock).flush({ items: [], total: 0 });
  });

  it('shows an access-denied message and hides the filter form and table on a 403', async () => {
    const { fixture, httpMock, root } = setUp();

    expectListRequest(httpMock).flush(
      { type: 'about:blank', title: 'Forbidden' },
      { status: 403, statusText: 'Forbidden' },
    );
    await fixture.whenStable();

    const alert = root.querySelector('[role="alert"]');
    expect(alert?.textContent).toContain('دسترسی لازم');
    expect(root.querySelector('table')).toBeNull();
    expect(root.querySelector('form')).toBeNull();
  });

  it('requests a later page with the paginator-chosen page size', async () => {
    const { fixture, httpMock, root } = setUp();

    flushInitial(httpMock, [editedEntry], 87);
    await fixture.whenStable();

    const nextPageButton = root.querySelector<HTMLButtonElement>(
      'button.mat-mdc-paginator-navigation-next',
    );
    nextPageButton?.dispatchEvent(new Event('click'));
    tick();

    const request = expectListRequest(httpMock);
    expect(request.request.body).toEqual({ page: 2, pageSize: 20 });

    request.flush({ items: [], total: 87 });
  });

  it('applies actor name, record id and a valid date range, resetting to the first page', async () => {
    const { fixture, httpMock, root } = setUp();
    flushInitial(httpMock);
    await fixture.whenStable();

    const actorInput = Array.from(root.querySelectorAll('input')).find((input) =>
      input.closest('mat-form-field')?.textContent?.includes('نام کاربر'),
    ) as HTMLInputElement;
    actorInput.value = 'مصطفی';
    actorInput.dispatchEvent(new Event('input'));

    const recordIdInput = Array.from(root.querySelectorAll('input')).find((input) =>
      input.closest('mat-form-field')?.textContent?.includes('شناسه رکورد'),
    ) as HTMLInputElement;
    recordIdInput.value = '66666666-6666-6666-6666-666666666666';
    recordIdInput.dispatchEvent(new Event('input'));

    const fromInput = Array.from(root.querySelectorAll('input')).find((input) =>
      input.closest('mat-form-field')?.textContent?.includes('از تاریخ'),
    ) as HTMLInputElement;
    fromInput.value = '1403/04/01 00:00';
    fromInput.dispatchEvent(new Event('input'));

    const form = root.querySelector('form');
    form?.dispatchEvent(new Event('submit', { cancelable: true }));
    tick();

    const request = expectListRequest(httpMock);
    expect(request.request.body).toEqual({
      page: 1,
      pageSize: 20,
      actorName: 'مصطفی',
      recordId: '66666666-6666-6666-6666-666666666666',
      from: '2024-06-21T00:00:00.000Z',
    });

    request.flush({ items: [editedEntry], total: 1 });
  });

  it('rejects a date range typed in an unrecognised format, without sending a request', async () => {
    const { fixture, httpMock, root } = setUp();
    flushInitial(httpMock);
    await fixture.whenStable();

    const fromInput = Array.from(root.querySelectorAll('input')).find((input) =>
      input.closest('mat-form-field')?.textContent?.includes('از تاریخ'),
    ) as HTMLInputElement;
    fromInput.value = 'not a date';
    fromInput.dispatchEvent(new Event('input'));

    const form = root.querySelector('form');
    form?.dispatchEvent(new Event('submit', { cancelable: true }));
    await fixture.whenStable();

    expect(root.querySelector('mat-error')?.textContent).toContain('قالب تاریخ و زمان معتبر نیست');
  });

  it('clears every filter field and reloads the unfiltered first page', async () => {
    const { fixture, httpMock, root } = setUp();
    flushInitial(httpMock);
    await fixture.whenStable();

    const actorInput = Array.from(root.querySelectorAll('input')).find((input) =>
      input.closest('mat-form-field')?.textContent?.includes('نام کاربر'),
    ) as HTMLInputElement;
    actorInput.value = 'مصطفی';
    actorInput.dispatchEvent(new Event('input'));

    const form = root.querySelector('form');
    form?.dispatchEvent(new Event('submit', { cancelable: true }));
    tick();
    expectListRequest(httpMock).flush({ items: [editedEntry], total: 1 });
    await fixture.whenStable();

    findButton(root, 'پاک کردن فیلترها')?.dispatchEvent(new Event('click'));
    tick();

    const request = expectListRequest(httpMock);
    expect(request.request.body).toEqual({ page: 1, pageSize: 20 });
    request.flush({ items: [editedEntry, registeredEntry], total: 2 });

    expect(actorInput.value).toBe('');
  });

  it('opens the changes dialog for an Edited row', async () => {
    const { fixture, httpMock, root } = setUp();
    flushInitial(httpMock);
    await fixture.whenStable();

    const dialog = TestBed.inject(MatDialog);
    const openSpy = vi
      .spyOn(dialog, 'open')
      .mockReturnValue({ afterClosed: () => of(undefined) } as MatDialogRef<unknown, unknown>);

    root
      .querySelector<HTMLButtonElement>(
        '[aria-label="جزئیات تغییرات 66666666-6666-6666-6666-666666666666"]',
      )
      ?.dispatchEvent(new Event('click'));

    expect(openSpy).toHaveBeenCalledWith(AuditLogChangesDialog, {
      data: {
        id: '1',
        actorName: 'مصطفی',
        recordTypeLabel: 'آنالیز استاندارد',
        occurredAt: '2024-06-21T08:30:00.000Z',
      },
    });
  });

  it('offers no drill-in button for a Registered or Deleted row', async () => {
    const { fixture, httpMock, root } = setUp();
    flushInitial(httpMock);
    await fixture.whenStable();

    expect(
      root.querySelector('[aria-label="جزئیات تغییرات 77777777-7777-7777-7777-777777777777"]'),
    ).toBeNull();
  });

  it('has a logout button that clears the session and navigates to the login page', async () => {
    const { fixture, httpMock, root } = setUp();
    flushInitial(httpMock);
    await fixture.whenStable();

    const session = TestBed.inject(SessionStore);
    session.store('a-token');
    const router = TestBed.inject(Router);
    const navigateSpy = vi.spyOn(router, 'navigateByUrl').mockResolvedValue(true);

    findButton(root, 'خروج از سیستم')?.dispatchEvent(new Event('click'));

    expect(session.isAuthenticated()).toBe(false);
    expect(navigateSpy).toHaveBeenCalledWith('/login');
  });
});
