import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ApplicationRef } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { MatDialog, MatDialogRef } from '@angular/material/dialog';
import { MatPaginatorIntl } from '@angular/material/paginator';
import { provideRouter } from '@angular/router';
import { of } from 'rxjs';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { Role } from '../../api/model';
import { CurrentUserStore } from '../../core/identity/current-user-store';
import { SessionStore } from '../../core/identity/session-store';
import { fakeAccessToken } from '../../core/identity/testing/fake-access-token';
import { provideJalaliDateAdapter } from '../../core/material/jalali-date-adapter';
import { PersianPaginatorIntl } from '../../core/material/persian-paginator-intl';
import { AuditLogChangesDialog } from './audit-log-changes-dialog';
import { AuditLogFilterDialog } from './audit-log-filter-dialog';
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
      provideJalaliDateAdapter(),
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

function expectFilterOptionsRequest(httpMock: HttpTestingController) {
  return httpMock.expectOne({ method: 'GET', url: '/api/audit-log/filter-options' });
}

const FILTER_OPTIONS = {
  actors: ['مصطفی', 'یاشار'],
  recordTypes: ['StandardBom', 'Bom'],
  actions: ['Registered', 'Edited'],
};

function flushInitial(
  httpMock: HttpTestingController,
  items = [editedEntry, registeredEntry],
  total = 2,
): void {
  expectListRequest(httpMock).flush({ items, total });
  expectFilterOptionsRequest(httpMock).flush(FILTER_OPTIONS);
}

/** The accessible names of the active-filter strip's remove buttons, one per chip, in order. */
function removeFilterLabels(root: HTMLElement): (string | null)[] {
  return Array.from(
    root.querySelectorAll('[aria-label="فیلترهای فعال"] button[aria-label^="حذف فیلتر"]'),
  ).map((button) => button.getAttribute('aria-label'));
}

function findButton(root: HTMLElement, text: string): HTMLButtonElement | undefined {
  return Array.from(root.querySelectorAll('button')).find(
    (button) => button.textContent?.trim() === text,
  );
}

/** A filter button is named by its aria-label — «فیلتر کاربر», or with the chosen count appended. */
function filterButton(root: HTMLElement, label: string): HTMLButtonElement | undefined {
  return root.querySelector<HTMLButtonElement>(`button[aria-label^="فیلتر ${label}"]`) ?? undefined;
}

/** Types into the record-id search and lets its pause elapse, as a person would. */
function searchRecordId(root: HTMLElement, text: string): void {
  const input = root.querySelector<HTMLInputElement>('input[type="search"]');
  input!.value = text;
  input!.dispatchEvent(new Event('input'));
  vi.advanceTimersByTime(300);
  tick();
}

describe('AuditLogPage', () => {
  afterEach(() => {
    vi.useRealTimers();
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
    expectFilterOptionsRequest(httpMock).flush(FILTER_OPTIONS);
  });

  it('renders every row with translated labels and the occurred-at instant as Jalali text', async () => {
    const { fixture, httpMock, root } = setUp();

    flushInitial(httpMock);
    await fixture.whenStable();

    expect(root.textContent).toContain('مصطفی');
    expect(root.textContent).toContain('آنالیز استاندارد');
    expect(root.textContent).toContain('66666666…');
    expect(root.textContent).toContain('ویرایش');
    // 2024-06-21T08:30:00Z is 1403/04/01 08:30 in Jalali.
    expect(root.textContent).toContain('۱۴۰۳/۰۴/۰۱ ۰۸:۳۰');
  });

  it("names a daily BOM's review events, older revocations included, in Persian in the action column", async () => {
    const { fixture, httpMock, root } = setUp();

    flushInitial(httpMock, [
      { ...registeredEntry, id: '3', action: 'Approved' },
      { ...registeredEntry, id: '4', action: 'Rejected' },
      { ...registeredEntry, id: '5', action: 'ReturnedToPending' },
      { ...registeredEntry, id: '6', action: 'ApprovalRevoked' },
    ]);
    await fixture.whenStable();

    const badges = Array.from(root.querySelectorAll('app-status-badge')).map((badge) =>
      badge.textContent?.trim(),
    );
    expect(badges).toEqual(['تایید', 'عدم تایید', 'بازگشت به در انتظار تایید', 'لغو تایید']);
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
    expectFilterOptionsRequest(httpMock).flush(FILTER_OPTIONS);
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
    expectFilterOptionsRequest(httpMock).flush(
      { title: 'Forbidden' },
      { status: 403, statusText: 'Forbidden' },
    );
    await fixture.whenStable();

    const alert = root.querySelector('[role="alert"]');
    expect(alert?.textContent).toContain('دسترسی لازم');
    expect(root.querySelector('table')).toBeNull();
    expect(root.querySelector('form')).toBeNull();
    expect(filterButton(root, 'کاربر')).toBeUndefined();
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

  it('searches the record id once typing pauses, resetting to the first page', async () => {
    const { fixture, httpMock, root } = setUp();
    flushInitial(httpMock);
    await fixture.whenStable();
    vi.useFakeTimers();

    const input = root.querySelector<HTMLInputElement>('input[type="search"]');
    input!.value = '66666666';
    input!.dispatchEvent(new Event('input'));
    tick();
    httpMock.expectNone({ method: 'POST', url: '/api/audit-log' });

    vi.advanceTimersByTime(300);
    tick();

    const request = expectListRequest(httpMock);
    expect(request.request.body).toEqual({
      page: 1,
      pageSize: 20,
      filters: { recordId: '66666666' },
    });
    request.flush({ items: [editedEntry], total: 1 });
  });

  it('applies a picked date range under filters, resetting to the first page', async () => {
    const { fixture, httpMock, root } = setUp();
    flushInitial(httpMock);
    await fixture.whenStable();

    // The fields take no typing; «اکنون» is the picker the page itself can press without a calendar.
    const before = Date.now();
    root
      .querySelector<HTMLButtonElement>('button[aria-label="اکنون برای آغاز بازه رویداد"]')
      ?.click();
    await fixture.whenStable();

    root.querySelector('form')?.dispatchEvent(new Event('submit', { cancelable: true }));
    tick();

    const request = expectListRequest(httpMock);
    const body = request.request.body as {
      page: number;
      pageSize: number;
      filters: Record<string, string>;
    };
    expect(body.page).toBe(1);
    expect(body.pageSize).toBe(20);
    expect(Object.keys(body.filters)).toEqual(['from']);
    const from = new Date(body.filters['from']).getTime();
    expect(from).toBeGreaterThanOrEqual(before);
    expect(from).toBeLessThanOrEqual(Date.now());

    request.flush({ items: [editedEntry], total: 1 });
  });

  function stubDialogResult(result: unknown) {
    const dialog = TestBed.inject(MatDialog);
    return vi
      .spyOn(dialog, 'open')
      .mockReturnValue({ afterClosed: () => of(result) } as MatDialogRef<unknown, unknown>);
  }

  it('offers the backend filter options, labelled in Persian, in the record-type dialog', async () => {
    const { fixture, httpMock, root } = setUp();
    flushInitial(httpMock);
    await fixture.whenStable();

    const openSpy = stubDialogResult(undefined);
    filterButton(root, 'نوع رکورد')?.dispatchEvent(new Event('click'));

    expect(openSpy).toHaveBeenCalledWith(AuditLogFilterDialog, {
      data: {
        fieldLabel: 'نوع رکورد',
        options: [
          { value: 'StandardBom', label: 'آنالیز استاندارد' },
          { value: 'Bom', label: 'آنالیز روزانه' },
        ],
        selectedValues: undefined,
      },
    });
  });

  it('offers the actors as they are named in the log', async () => {
    const { fixture, httpMock, root } = setUp();
    flushInitial(httpMock);
    await fixture.whenStable();

    const openSpy = stubDialogResult(undefined);
    filterButton(root, 'کاربر')?.dispatchEvent(new Event('click'));

    const data = openSpy.mock.calls[0][1]?.data as { options: unknown };
    expect(data.options).toEqual([
      { value: 'مصطفی', label: 'مصطفی' },
      { value: 'یاشار', label: 'یاشار' },
    ]);
  });

  it('sends the selected actions under filters.actions and returns to the first page', async () => {
    const { fixture, httpMock, root } = setUp();
    flushInitial(httpMock);
    await fixture.whenStable();

    stubDialogResult({ selected: ['Edited'] });
    filterButton(root, 'نوع رویداد')?.dispatchEvent(new Event('click'));
    tick();

    const request = expectListRequest(httpMock);
    expect(request.request.body).toEqual({
      page: 1,
      pageSize: 20,
      filters: { actions: ['Edited'] },
    });
    request.flush({ items: [editedEntry], total: 1 });
  });

  it('sends an empty list when the dialog applies with nothing checked', async () => {
    const { fixture, httpMock, root } = setUp();
    flushInitial(httpMock);
    await fixture.whenStable();

    stubDialogResult({ selected: [] });
    filterButton(root, 'کاربر')?.dispatchEvent(new Event('click'));
    tick();

    const request = expectListRequest(httpMock);
    expect(request.request.body).toEqual({ page: 1, pageSize: 20, filters: { actors: [] } });
    request.flush({ items: [], total: 0 });
  });

  it('keeps a list filter when the record id is searched afterwards', async () => {
    const { fixture, httpMock, root } = setUp();
    flushInitial(httpMock);
    await fixture.whenStable();
    vi.useFakeTimers();

    stubDialogResult({ selected: ['مصطفی'] });
    filterButton(root, 'کاربر')?.dispatchEvent(new Event('click'));
    tick();
    expectListRequest(httpMock).flush({ items: [editedEntry], total: 1 });
    tick();

    searchRecordId(root, 'r-1');

    const request = expectListRequest(httpMock);
    expect(request.request.body).toEqual({
      page: 1,
      pageSize: 20,
      filters: { actors: ['مصطفی'], recordId: 'r-1' },
    });
    request.flush({ items: [], total: 0 });
  });

  it('shows the chosen list filters as removable chips', async () => {
    const { fixture, httpMock, root } = setUp();
    flushInitial(httpMock);
    await fixture.whenStable();

    stubDialogResult({ selected: ['Edited'] });
    filterButton(root, 'نوع رویداد')?.dispatchEvent(new Event('click'));
    tick();
    expectListRequest(httpMock).flush({ items: [editedEntry], total: 1 });
    await fixture.whenStable();

    const chips = root.querySelector('[aria-label="فیلترهای فعال"]');
    expect(chips?.textContent).toContain('نوع رویداد');
    expect(chips?.textContent).toContain('ویرایش');

    root
      .querySelector<HTMLButtonElement>('[aria-label="حذف فیلتر نوع رویداد: ویرایش"]')
      ?.dispatchEvent(new Event('click'));
    tick();

    const request = expectListRequest(httpMock);
    expect(request.request.body).toEqual({ page: 1, pageSize: 20 });
    request.flush({ items: [editedEntry, registeredEntry], total: 2 });
  });

  it('shows each chosen value as its own chip, and removing one keeps the others', async () => {
    const { fixture, httpMock, root } = setUp();
    flushInitial(httpMock);
    await fixture.whenStable();

    stubDialogResult({ selected: ['Registered', 'Edited'] });
    filterButton(root, 'نوع رویداد')?.dispatchEvent(new Event('click'));
    tick();
    expectListRequest(httpMock).flush({ items: [editedEntry, registeredEntry], total: 2 });
    await fixture.whenStable();

    expect(removeFilterLabels(root)).toEqual([
      'حذف فیلتر نوع رویداد: ثبت',
      'حذف فیلتر نوع رویداد: ویرایش',
    ]);

    root
      .querySelector<HTMLButtonElement>('[aria-label="حذف فیلتر نوع رویداد: ثبت"]')
      ?.dispatchEvent(new Event('click'));
    tick();

    const request = expectListRequest(httpMock);
    expect(request.request.body).toEqual({
      page: 1,
      pageSize: 20,
      filters: { actions: ['Edited'] },
    });
    request.flush({ items: [editedEntry], total: 1 });
    await fixture.whenStable();
    expect(removeFilterLabels(root)).toEqual(['حذف فیلتر نوع رویداد: ویرایش']);
  });

  it('shows a list filter with nothing chosen as one removable «هیچ‌کدام» chip', async () => {
    const { fixture, httpMock, root } = setUp();
    flushInitial(httpMock);
    await fixture.whenStable();

    stubDialogResult({ selected: [] });
    filterButton(root, 'کاربر')?.dispatchEvent(new Event('click'));
    tick();
    expectListRequest(httpMock).flush({ items: [], total: 0 });
    await fixture.whenStable();

    expect(removeFilterLabels(root)).toEqual(['حذف فیلتر کاربر: هیچ‌کدام']);

    root
      .querySelector<HTMLButtonElement>('[aria-label="حذف فیلتر کاربر: هیچ‌کدام"]')
      ?.dispatchEvent(new Event('click'));
    tick();
    const request = expectListRequest(httpMock);
    expect(request.request.body).toEqual({ page: 1, pageSize: 20 });
    request.flush({ items: [editedEntry, registeredEntry], total: 2 });
  });

  it('ignores a cancelled filter dialog', async () => {
    const { fixture, httpMock, root } = setUp();
    flushInitial(httpMock);
    await fixture.whenStable();

    stubDialogResult(undefined);
    filterButton(root, 'کاربر')?.dispatchEvent(new Event('click'));
    tick();

    httpMock.expectNone({ method: 'POST', url: '/api/audit-log' });
  });

  it('clears every filter field and reloads the unfiltered first page', async () => {
    const { fixture, httpMock, root } = setUp();
    flushInitial(httpMock);
    await fixture.whenStable();
    vi.useFakeTimers();

    stubDialogResult({ selected: ['مصطفی'] });
    filterButton(root, 'کاربر')?.dispatchEvent(new Event('click'));
    tick();
    expectListRequest(httpMock).flush({ items: [editedEntry], total: 1 });
    tick();

    searchRecordId(root, 'r-1');
    expectListRequest(httpMock).flush({ items: [editedEntry], total: 1 });
    tick();

    findButton(root, 'پاک کردن فیلترها')?.dispatchEvent(new Event('click'));
    tick();

    const request = expectListRequest(httpMock);
    expect(request.request.body).toEqual({ page: 1, pageSize: 20 });
    request.flush({ items: [editedEntry, registeredEntry], total: 2 });
    tick();

    expect(root.querySelector<HTMLInputElement>('input[type="search"]')?.value).toBe('');
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
        recordType: 'StandardBom',
        recordId: '66666666-6666-6666-6666-666666666666',
        recordTypeLabel: 'آنالیز استاندارد',
        action: 'Edited',
        occurredAt: '2024-06-21T08:30:00.000Z',
        canRevert: false,
      },
    });
  });

  describe('a bulk material import', () => {
    const importEntry = {
      id: '9',
      occurredAt: '2026-10-29T09:00:00.000Z',
      actorName: 'مصطفی',
      recordType: 'MaterialImport',
      recordId: 'import-1',
      action: 'Imported',
    };

    /** The page as the System Admin, the one role that reaches it — resolved before it renders. */
    async function setUpAsSystemAdmin() {
      localStorage.clear();
      TestBed.configureTestingModule({
        providers: [
          provideHttpClient(),
          provideHttpClientTesting(),
          provideRouter([]),
          { provide: MatPaginatorIntl, useClass: PersianPaginatorIntl },
          provideJalaliDateAdapter(),
        ],
      });
      const httpMock = TestBed.inject(HttpTestingController);
      TestBed.inject(SessionStore).store(fakeAccessToken());
      const pending = TestBed.inject(CurrentUserStore).load();
      httpMock
        .expectOne({ method: 'GET', url: '/api/users/me' })
        .flush({ id: '1', name: 'Yashar', username: 'yashar', role: Role.system_admin });
      await pending;

      const fixture = TestBed.createComponent(AuditLogPage);
      tick();
      return { fixture, httpMock, root: fixture.nativeElement as HTMLElement };
    }

    it('names the record type and the action in Persian', async () => {
      const { fixture, httpMock, root } = setUp();
      flushInitial(httpMock, [importEntry], 1);
      await fixture.whenStable();

      expect(root.textContent).toContain('بارگذاری گروهی');
    });

    it('lets the System Admin revert it from its details', async () => {
      const { fixture, httpMock, root } = await setUpAsSystemAdmin();
      flushInitial(httpMock, [importEntry], 1);
      await fixture.whenStable();
      const openSpy = vi
        .spyOn(TestBed.inject(MatDialog), 'open')
        .mockReturnValue({ afterClosed: () => of(undefined) } as MatDialogRef<unknown, unknown>);

      root
        .querySelector<HTMLButtonElement>('[aria-label="جزئیات تغییرات import-1"]')
        ?.dispatchEvent(new Event('click'));

      expect(openSpy).toHaveBeenCalledWith(
        AuditLogChangesDialog,
        expect.objectContaining({
          data: expect.objectContaining({
            recordType: 'MaterialImport',
            recordId: 'import-1',
            recordTypeLabel: 'بارگذاری گروهی',
            action: 'Imported',
            canRevert: true,
          }),
        }),
      );
    });

    it('re-reads the log and its filter options once the import has been reverted', async () => {
      const { fixture, httpMock, root } = await setUpAsSystemAdmin();
      flushInitial(httpMock, [importEntry], 1);
      await fixture.whenStable();
      vi.spyOn(TestBed.inject(MatDialog), 'open').mockReturnValue({
        afterClosed: () => of(true),
      } as MatDialogRef<unknown, boolean>);

      root
        .querySelector<HTMLButtonElement>('[aria-label="جزئیات تغییرات import-1"]')
        ?.dispatchEvent(new Event('click'));
      tick();

      expectListRequest(httpMock).flush({ items: [importEntry], total: 1 });
      expectFilterOptionsRequest(httpMock).flush(FILTER_OPTIONS);
    });
  });

  it('opens the changes dialog for a Registered row too, naming its action', async () => {
    const { fixture, httpMock, root } = setUp();
    flushInitial(httpMock);
    await fixture.whenStable();

    const dialog = TestBed.inject(MatDialog);
    const openSpy = vi
      .spyOn(dialog, 'open')
      .mockReturnValue({ afterClosed: () => of(undefined) } as MatDialogRef<unknown, unknown>);

    root
      .querySelector<HTMLButtonElement>(
        '[aria-label="جزئیات تغییرات 77777777-7777-7777-7777-777777777777"]',
      )
      ?.dispatchEvent(new Event('click'));

    expect(openSpy).toHaveBeenCalledWith(
      AuditLogChangesDialog,
      expect.objectContaining({ data: expect.objectContaining({ action: 'Registered' }) }),
    );
  });
});
