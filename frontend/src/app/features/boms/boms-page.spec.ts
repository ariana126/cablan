import { Clipboard } from '@angular/cdk/clipboard';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ApplicationRef } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { MatDialog, MatDialogRef } from '@angular/material/dialog';
import { MatPaginatorIntl } from '@angular/material/paginator';
import { MatSnackBar, MatSnackBarRef, TextOnlySnackBar } from '@angular/material/snack-bar';
import { provideRouter } from '@angular/router';
import { of } from 'rxjs';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { Role } from '../../api/model';
import { CurrentUserStore } from '../../core/identity/current-user-store';
import { SessionStore } from '../../core/identity/session-store';
import { provideJalaliDateAdapter } from '../../core/material/jalali-date-adapter';
import { PersianPaginatorIntl } from '../../core/material/persian-paginator-intl';
import { FileSaver } from '../../core/files/file-saver';
import { BomFormDialog } from './bom-form-dialog';
import { BomReportDetailDialog } from './bom-report-detail-dialog';
import { BomReportFilterDialog } from './bom-report-filter-dialog';
import { BomsPage } from './boms-page';
import { ConfirmDeleteBomDialog } from './confirm-delete-bom-dialog';
import { fakeAccessToken } from '../../core/identity/testing/fake-access-token';

const filterOptions = {
  brands: ['لگراند', 'نگزنس'],
  componentNames: ['مغزی', 'روکش'],
  standardBomMiCodes: ['1001', '1002'],
  productNames: ['کابل شبکه U/UTP 0.42 LEGRAND'],
  registeredByUsers: ['نیکروش', 'مصطفی'],
};

const standardBoms = [
  {
    id: 'standard-bom-1',
    miCode: '1001',
    brand: 'لگراند',
    standardLength: 305,
    active: true,
    description: '',
    productId: 'product-1',
    components: [],
  },
];

const products = [{ id: 'product-1', name: 'کابل شبکه U/UTP 0.42 LEGRAND', components: [] }];

/** What `GET /boms/:id` answers for `row1` — the superset the edit form is projected out of. */
const bom1Detail = {
  id: '1',
  standardBomId: 'standard-bom-1',
  standardBomMiCode: '1001',
  brand: 'لگراند',
  productName: 'کابل شبکه U/UTP 0.42 LEGRAND',
  standardLength: 305,
  orderNumber: 'ORD-2001',
  trackingNumber: 'TRK-3001',
  registeredBy: 'نیکروش',
  registeredAt: '2024-06-21T08:30:00.000Z',
  description: 'بررسی کیفیت اولیه',
  totalWeight: 10,
  components: [
    { id: 'component-1', name: 'مغزی', materials: [{ id: 'material-1', name: 'مسی', weight: 10 }] },
  ],
};

/** The same daily BOM as the form dialog receives it — `bom1Detail` minus its display-only fields. */
const bom1 = {
  id: '1',
  standardBomId: 'standard-bom-1',
  orderNumber: 'ORD-2001',
  trackingNumber: 'TRK-3001',
  description: 'بررسی کیفیت اولیه',
  components: [
    { id: 'component-1', name: 'مغزی', materials: [{ id: 'material-1', name: 'مسی', weight: 10 }] },
  ],
};

const row1 = {
  id: '1',
  orderNumber: 'ORD-2001',
  trackingNumber: 'TRK-3001',
  registeredAt: '2024-06-21T08:30:00.000Z',
  registeredBy: 'نیکروش',
  standardBomMiCode: '1001',
  brand: 'لگراند',
  productName: 'کابل شبکه U/UTP 0.42 LEGRAND',
};

/**
 * Renders the page for a signed-in user of `role`, defaulting to the کنترلگر the write actions
 * exist for. The role is resolved *before* the component is created, exactly as `guardedRoute` does
 * it in production — the page reads `CurrentUserStore.role()` synchronously to decide what to offer.
 */
async function setUp(role: Role = Role.qc_inspector) {
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
    .flush({ id: '1', name: 'Sina Ghadrdan', username: 'sina.q', role });
  await pending;

  const fixture = TestBed.createComponent(BomsPage);
  TestBed.inject(ApplicationRef).tick();

  return { fixture, httpMock, root: fixture.nativeElement as HTMLElement };
}

function tick(): void {
  TestBed.inject(ApplicationRef).tick();
}

/**
 * The three requests the page fires on load besides the report itself: the filter panel's distinct
 * values, the standard BOMs the create/edit form's picker is built from, and the products that
 * form names the chosen standard BOM's product from.
 */
function flushSupportingRequests(httpMock: HttpTestingController): void {
  httpMock
    .expectOne({ method: 'GET', url: '/api/boms/report/filter-options' })
    .flush(filterOptions);
  httpMock.expectOne({ method: 'GET', url: '/api/standard-boms' }).flush(standardBoms);
  httpMock.expectOne({ method: 'GET', url: '/api/products' }).flush(products);
}

function expectReportRequest(httpMock: HttpTestingController) {
  return httpMock.expectOne({ method: 'POST', url: '/api/boms/report' });
}

function flushInitial(httpMock: HttpTestingController, items = [row1], total = 1): void {
  flushSupportingRequests(httpMock);
  expectReportRequest(httpMock).flush({ items, total });
}

/** A column's filter button, by its accessible name «فیلتر {column}» (with a count once active). */
function filterButton(root: HTMLElement, column: string): HTMLButtonElement | null {
  return root.querySelector<HTMLButtonElement>(`button[aria-label^="فیلتر ${column}"]`);
}

/** Opens a row's «عملیات بیشتر» menu — the one place edit, copy-id and delete live. */
function openRowMenu(root: HTMLElement, orderNumber: string): void {
  root
    .querySelector<HTMLButtonElement>(`[aria-label="عملیات بیشتر برای ${orderNumber}"]`)
    ?.dispatchEvent(new Event('click'));
  tick();
}

function menuItem(text: string): HTMLElement | undefined {
  return Array.from(document.body.querySelectorAll<HTMLElement>('[role="menuitem"]')).find(
    (item) => item.textContent?.trim() === text,
  );
}

function chooseRowAction(root: HTMLElement, orderNumber: string, action: string): void {
  openRowMenu(root, orderNumber);
  menuItem(action)?.dispatchEvent(new Event('click'));
}

function findButton(root: HTMLElement, text: string): HTMLButtonElement | undefined {
  return Array.from(root.querySelectorAll('button')).find(
    (button) => button.textContent?.trim() === text,
  );
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

describe('BomsPage', () => {
  afterEach(() => {
    TestBed.inject(HttpTestingController).verify();
  });

  it('shows a loading indicator before the report arrives', async () => {
    const { httpMock, root } = await setUp();

    expect(root.querySelector('mat-progress-bar')).not.toBeNull();

    flushInitial(httpMock);
  });

  it('requests the first page with every filter field left unset', async () => {
    const { httpMock } = await setUp();

    flushSupportingRequests(httpMock);
    const request = expectReportRequest(httpMock);
    // An empty `filters` object is exactly as unfiltered as an absent one — every field inside it
    // is what the backend actually branches on (`BomReportGateway`'s own spec proves the per-field
    // omission this depends on).
    expect(request.request.body).toEqual({ page: 1, pageSize: 20, filters: {} });

    request.flush({ items: [row1], total: 1 });
  });

  it('renders every row, with the registered-at instant shown as Jalali text', async () => {
    const { fixture, httpMock, root } = await setUp();

    flushInitial(httpMock);
    await fixture.whenStable();

    expect(root.textContent).toContain('ORD-2001');
    expect(root.textContent).toContain('TRK-3001');
    expect(root.textContent).toContain('نیکروش');
    expect(root.textContent).toContain('1001');
    expect(root.textContent).toContain('لگراند');
    expect(root.textContent).toContain('کابل شبکه U/UTP 0.42 LEGRAND');
    // 2024-06-21T08:30:00Z is 1403/04/01 08:30 in Jalali — the exact background-fixture instant this
    // feature area's own conversion round-trips against.
    expect(root.textContent).toContain('۱۴۰۳/۰۴/۰۱ ۰۸:۳۰');
  });

  it('shows exactly the seven business columns the feature specifies, in order', async () => {
    const { fixture, httpMock, root } = await setUp();

    flushInitial(httpMock);
    await fixture.whenStable();

    const headers = Array.from(root.querySelectorAll('th')).map((th) => th.textContent?.trim());
    // The trailing «عملیات» is the actions column's screen-reader-only header, not a business
    // column: it holds no data and renders no visible text.
    expect(headers).toEqual([
      'شماره ردیابی',
      'شماره سفارش',
      'کد MI',
      'نام محصول',
      'برند',
      'کنترلگر',
      'تاریخ و زمان ثبت',
      'عملیات',
    ]);
  });

  it('shows an empty-state message when nothing matches', async () => {
    const { fixture, httpMock, root } = await setUp();

    flushInitial(httpMock, [], 0);
    await fixture.whenStable();

    expect(root.textContent).toContain('هیچ آنالیز روزانه‌ای یافت نشد');
  });

  it('shows a generic error and a retry button when the report fails to load', async () => {
    const { fixture, httpMock, root } = await setUp();

    flushSupportingRequests(httpMock);
    expectReportRequest(httpMock).flush(
      { title: 'Internal Server Error' },
      { status: 500, statusText: 'Server Error' },
    );
    await fixture.whenStable();

    const alert = root.querySelector('[role="alert"]');
    expect(alert?.textContent).toContain('بارگذاری نشد');
    expect(root.querySelector('table')).toBeNull();

    findButton(root, 'تلاش دوباره')?.dispatchEvent(new Event('click'));
    tick();
    expectReportRequest(httpMock).flush({ items: [row1], total: 1 });
  });

  it('requests a later page with the paginator-chosen page size', async () => {
    const { fixture, httpMock, root } = await setUp();

    flushInitial(httpMock, [row1], 87);
    await fixture.whenStable();

    const nextPageButton = root.querySelector<HTMLButtonElement>(
      'button.mat-mdc-paginator-navigation-next',
    );
    nextPageButton?.dispatchEvent(new Event('click'));
    tick();

    const request = expectReportRequest(httpMock);
    expect(request.request.body).toEqual({ page: 2, pageSize: 20, filters: {} });

    request.flush({ items: [], total: 87 });
  });

  it('opens a filter dialog seeded with every distinct value and no prior selection', async () => {
    const { fixture, httpMock, root } = await setUp();
    flushInitial(httpMock);
    await fixture.whenStable();

    const dialog = TestBed.inject(MatDialog);
    const openSpy = vi
      .spyOn(dialog, 'open')
      .mockReturnValue({ afterClosed: () => of(undefined) } as MatDialogRef<unknown, unknown>);

    filterButton(root, 'برند')?.dispatchEvent(new Event('click'));

    expect(openSpy).toHaveBeenCalledWith(BomReportFilterDialog, {
      data: { fieldLabel: 'برند', allValues: filterOptions.brands, selectedValues: undefined },
    });
  });

  it('re-requests the report with the applied filter and resets to the first page', async () => {
    const { fixture, httpMock, root } = await setUp();
    flushInitial(httpMock);
    await fixture.whenStable();

    const dialog = TestBed.inject(MatDialog);
    vi.spyOn(dialog, 'open').mockReturnValue({
      afterClosed: () => of({ selected: ['لگراند'] }),
    } as MatDialogRef<unknown, unknown>);

    filterButton(root, 'برند')?.dispatchEvent(new Event('click'));
    tick();

    const request = expectReportRequest(httpMock);
    expect(request.request.body).toEqual({
      page: 1,
      pageSize: 20,
      filters: { brands: ['لگراند'] },
    });

    request.flush({ items: [row1], total: 1 });
  });

  it('opens with the page title as its one level-one heading and the list as a named region', async () => {
    const { fixture, httpMock, root } = await setUp();
    flushInitial(httpMock);
    await fixture.whenStable();

    expect(root.querySelectorAll('h1')).toHaveLength(1);
    expect(root.querySelector('h1')?.textContent?.trim()).toBe('آنالیز های روزانه');
    const sheet = root.querySelector('section[aria-labelledby]');
    expect(root.querySelector(`#${sheet?.getAttribute('aria-labelledby')}`)?.textContent).toBe(
      'فهرست آنالیزها',
    );
  });

  it('counts the results in Persian digits in the sheet bar', async () => {
    const { fixture, httpMock, root } = await setUp();
    flushInitial(httpMock, [row1], 1);
    await fixture.whenStable();

    expect(root.querySelector('[role="status"]')?.textContent?.trim()).toBe('۱ نتیجه');
  });

  it('shows an applied filter as a chip, and removing the chip lifts that filter', async () => {
    const { fixture, httpMock, root } = await setUp();
    flushInitial(httpMock);
    await fixture.whenStable();
    vi.spyOn(TestBed.inject(MatDialog), 'open').mockReturnValue({
      afterClosed: () => of({ selected: ['لگراند'] }),
    } as MatDialogRef<unknown, unknown>);

    filterButton(root, 'برند')?.dispatchEvent(new Event('click'));
    tick();
    expectReportRequest(httpMock).flush({ items: [row1], total: 1 });
    await fixture.whenStable();

    expect(root.textContent).toContain('برند: لگراند');
    expect(filterButton(root, 'برند')?.getAttribute('aria-label')).toBe(
      'فیلتر برند، ۱ مقدار انتخاب شده',
    );

    root
      .querySelector<HTMLButtonElement>('[aria-label="حذف فیلتر برند: لگراند"]')
      ?.dispatchEvent(new Event('click'));
    tick();
    const request = expectReportRequest(httpMock);
    expect(request.request.body).toEqual({ page: 1, pageSize: 20, filters: {} });
    request.flush({ items: [row1], total: 1 });
  });

  it('offers to clear the filters from the empty state only while some are on', async () => {
    const { fixture, httpMock, root } = await setUp();
    flushInitial(httpMock, [], 0);
    await fixture.whenStable();
    expect(findButton(root, 'پاک کردن فیلترها')).toBeUndefined();

    vi.spyOn(TestBed.inject(MatDialog), 'open').mockReturnValue({
      afterClosed: () => of({ selected: ['نگزنس'] }),
    } as MatDialogRef<unknown, unknown>);
    filterButton(root, 'برند')?.dispatchEvent(new Event('click'));
    tick();
    expectReportRequest(httpMock).flush({ items: [], total: 0 });
    await fixture.whenStable();

    expect(findButton(root, 'پاک کردن فیلترها')).toBeDefined();
  });

  it('applies a valid registered-at range as an ISO instant', async () => {
    const { fixture, httpMock, root } = await setUp();
    flushInitial(httpMock);
    await fixture.whenStable();

    const fromInput = Array.from(root.querySelectorAll('input')).find((input) =>
      input.closest('mat-form-field')?.textContent?.includes('از تاریخ ثبت'),
    ) as HTMLInputElement;
    // The lower bound is a calendar field now; a date with no time is the midnight this always meant.
    fromInput.value = '1403/04/01';
    fromInput.dispatchEvent(new Event('input'));
    fromInput.dispatchEvent(new Event('blur'));
    await fixture.whenStable();

    const form = root.querySelector('form');
    form?.dispatchEvent(new Event('submit', { cancelable: true }));
    tick();

    const request = expectReportRequest(httpMock);
    expect(request.request.body).toEqual({
      page: 1,
      pageSize: 20,
      filters: { registeredAtFrom: '2024-06-21T00:00:00.000Z' },
    });

    request.flush({ items: [row1], total: 1 });
    await fixture.whenStable();
  });

  it('applies a preset range on the press, without waiting for «اعمال بازه»', async () => {
    const { fixture, httpMock, root } = await setUp();
    flushInitial(httpMock);
    await fixture.whenStable();

    findButton(root, 'امروز')?.dispatchEvent(new Event('click'));
    tick();

    const request = expectReportRequest(httpMock);
    const filters = (request.request.body as { filters: Record<string, string> }).filters;
    const from = new Date(filters['registeredAtFrom']);
    const midnight = new Date();
    midnight.setHours(0, 0, 0, 0);

    expect(from).toEqual(midnight);
    expect(new Date(filters['registeredAtTo']).getTime()).toBeLessThanOrEqual(Date.now());

    request.flush({ items: [row1], total: 1 });
    await fixture.whenStable();
  });

  it('leaves the checkbox filters alone when a preset range is applied', async () => {
    const { fixture, httpMock, root } = await setUp();
    flushInitial(httpMock);
    await fixture.whenStable();

    findButton(root, '۷ روز گذشته')?.dispatchEvent(new Event('click'));
    tick();

    const request = expectReportRequest(httpMock);
    const filters = (request.request.body as { filters: Record<string, unknown> }).filters;

    expect(Object.keys(filters).sort()).toEqual(['registeredAtFrom', 'registeredAtTo']);

    request.flush({ items: [row1], total: 1 });
    await fixture.whenStable();
  });

  it('rejects a registered-at range typed in an unrecognised format, without sending a request', async () => {
    const { fixture, httpMock, root } = await setUp();
    flushInitial(httpMock);
    await fixture.whenStable();

    const fromInput = Array.from(root.querySelectorAll('input')).find((input) =>
      input.closest('mat-form-field')?.textContent?.includes('از تاریخ ثبت'),
    ) as HTMLInputElement;
    fromInput.value = 'not a date';
    fromInput.dispatchEvent(new Event('input'));
    fromInput.dispatchEvent(new Event('blur'));
    await fixture.whenStable();

    const form = root.querySelector('form');
    form?.dispatchEvent(new Event('submit', { cancelable: true }));
    await fixture.whenStable();

    expect(root.querySelector('mat-error')?.textContent).toContain('قالب تاریخ و زمان معتبر نیست');
    httpMock.expectNone(() => true);
  });

  it('opens the detail dialog for the row its button was clicked on', async () => {
    const { fixture, httpMock, root } = await setUp();
    flushInitial(httpMock);
    await fixture.whenStable();

    const dialog = TestBed.inject(MatDialog);
    const openSpy = vi
      .spyOn(dialog, 'open')
      .mockReturnValue({ afterClosed: () => of(undefined) } as MatDialogRef<unknown, unknown>);

    root
      .querySelector<HTMLButtonElement>('[aria-label="جزئیات ORD-2001"]')
      ?.dispatchEvent(new Event('click'));

    expect(openSpy).toHaveBeenCalledWith(BomReportDetailDialog, {
      data: { id: '1', orderNumber: 'ORD-2001', canManage: true },
    });
  });

  /** Opens the «خروجی اکسل» menu and picks the format at `index` (0 «هر مواد اولیه یک ردیف», 1
   * the one-row-per-analysis layout). */
  function chooseExportFormat(root: HTMLElement, index: number): void {
    findButton(root, 'خروجی اکسل')?.dispatchEvent(new Event('click'));
    tick();
    const items = document.body.querySelectorAll<HTMLButtonElement>('.mat-mdc-menu-item');
    items[index]?.dispatchEvent(new Event('click'));
  }

  it('downloads the server-built workbook of the filtered list, in the chosen format', async () => {
    const { fixture, httpMock, root } = await setUp();
    flushInitial(httpMock);
    await fixture.whenStable();

    const saveSpy = vi.spyOn(TestBed.inject(FileSaver), 'save').mockReturnValue(undefined);

    // Apply a filter first — the export must respect it, and must never fall back to page/pageSize.
    const dialog = TestBed.inject(MatDialog);
    vi.spyOn(dialog, 'open').mockReturnValue({
      afterClosed: () => of({ selected: ['لگراند'] }),
    } as MatDialogRef<unknown, unknown>);
    filterButton(root, 'برند')?.dispatchEvent(new Event('click'));
    tick();
    expectReportRequest(httpMock).flush({ items: [row1], total: 1 });
    await fixture.whenStable();

    chooseExportFormat(root, 1);

    const request = httpMock.expectOne({ method: 'POST', url: '/api/boms/report/export' });
    expect(request.request.body).toEqual({
      format: 'perBom',
      timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      filters: { brands: ['لگراند'] },
    });
    tick();
    expect(findButton(root, 'خروجی اکسل')?.disabled).toBe(true);

    const workbook = new Blob(['xlsx']);
    request.flush(workbook, {
      headers: { 'Content-Disposition': "attachment; filename*=UTF-8''%DA%AF.xlsx" },
    });
    await fixture.whenStable();

    expect(saveSpy).toHaveBeenCalledWith(workbook, 'گ.xlsx');
    expect(findButton(root, 'خروجی اکسل')?.disabled).toBe(false);
  });

  it('tells the visitor when the export fails, and lets them try again', async () => {
    const { fixture, httpMock, root } = await setUp();
    flushInitial(httpMock);
    await fixture.whenStable();

    const saveSpy = vi.spyOn(TestBed.inject(FileSaver), 'save').mockReturnValue(undefined);
    const snackBarSpy = vi
      .spyOn(TestBed.inject(MatSnackBar), 'open')
      .mockReturnValue({} as MatSnackBarRef<TextOnlySnackBar>);

    chooseExportFormat(root, 0);
    httpMock
      .expectOne({ method: 'POST', url: '/api/boms/report/export' })
      .flush(new Blob(['{}']), { status: 500, statusText: 'Server Error' });
    await fixture.whenStable();

    expect(saveSpy).not.toHaveBeenCalled();
    expect(snackBarSpy).toHaveBeenCalledWith('خروجی اکسل گرفته نشد.', 'باشه', { duration: 5000 });
    expect(findButton(root, 'خروجی اکسل')?.disabled).toBe(false);
  });

  it('opens the create dialog and reloads the list once a daily BOM is registered', async () => {
    const { fixture, httpMock, root } = await setUp();
    flushSupportingRequests(httpMock);
    expectReportRequest(httpMock).flush({ items: [], total: 0 });
    await fixture.whenStable();

    const dialog = TestBed.inject(MatDialog);
    const openSpy = vi
      .spyOn(dialog, 'open')
      .mockReturnValue({ afterClosed: () => of(true) } as MatDialogRef<unknown, boolean>);

    findButton(root, 'افزودن آنالیز روزانه')?.dispatchEvent(new Event('click'));
    tick();

    expect(openSpy).toHaveBeenCalledWith(BomFormDialog, {
      data: { mode: 'create', standardBoms, products },
    });

    expectReportRequest(httpMock).flush({ items: [row1], total: 1 });
    await fixture.whenStable();

    expect(root.textContent).toContain('ORD-2001');
  });

  it('fetches the whole daily BOM before opening the edit dialog for the row clicked', async () => {
    const { fixture, httpMock, root } = await setUp();
    flushInitial(httpMock);
    await fixture.whenStable();

    const dialog = TestBed.inject(MatDialog);
    const openSpy = vi
      .spyOn(dialog, 'open')
      .mockReturnValue({ afterClosed: () => of(false) } as MatDialogRef<unknown, boolean>);

    chooseRowAction(root, 'ORD-2001', 'ویرایش');

    // The row itself carries neither the composition nor the standard BOM's id, so the form cannot
    // be opened from it.
    expect(openSpy).not.toHaveBeenCalled();

    httpMock.expectOne({ method: 'GET', url: '/api/boms/1' }).flush(bom1Detail);
    tick();

    expect(openSpy).toHaveBeenCalledWith(BomFormDialog, {
      data: { mode: 'edit', bom: bom1, standardBoms, products },
    });
  });

  it('reports a failed edit fetch instead of opening an empty form', async () => {
    const { fixture, httpMock, root } = await setUp();
    flushInitial(httpMock);
    await fixture.whenStable();

    const dialog = TestBed.inject(MatDialog);
    const openSpy = vi.spyOn(dialog, 'open');
    const snackBar = TestBed.inject(MatSnackBar);
    const snackBarSpy = vi
      .spyOn(snackBar, 'open')
      .mockReturnValue({} as MatSnackBarRef<TextOnlySnackBar>);

    chooseRowAction(root, 'ORD-2001', 'ویرایش');

    httpMock
      .expectOne({ method: 'GET', url: '/api/boms/1' })
      .flush({ title: 'Internal Server Error' }, { status: 500, statusText: 'Server Error' });
    tick();

    expect(openSpy).not.toHaveBeenCalled();
    expect(snackBarSpy).toHaveBeenCalled();
  });

  it('opens the delete confirmation for the row its button was clicked on', async () => {
    const { fixture, httpMock, root } = await setUp();
    flushInitial(httpMock);
    await fixture.whenStable();

    const dialog = TestBed.inject(MatDialog);
    const openSpy = vi
      .spyOn(dialog, 'open')
      .mockReturnValue({ afterClosed: () => of(false) } as MatDialogRef<unknown, boolean>);

    chooseRowAction(root, 'ORD-2001', 'حذف');

    expect(openSpy).toHaveBeenCalledWith(ConfirmDeleteBomDialog, {
      data: { bom: { id: '1', orderNumber: 'ORD-2001' } },
    });
  });

  it('opens the edit form from the detail card without re-fetching the daily BOM', async () => {
    const { fixture, httpMock, root } = await setUp();
    flushInitial(httpMock);
    await fixture.whenStable();

    const dialog = TestBed.inject(MatDialog);
    const openSpy = vi.spyOn(dialog, 'open').mockImplementation(
      (component) =>
        ({
          afterClosed: () =>
            of(
              component === BomReportDetailDialog ? { action: 'edit', detail: bom1Detail } : false,
            ),
        }) as MatDialogRef<unknown, unknown>,
    );

    root
      .querySelector<HTMLButtonElement>('[aria-label="جزئیات ORD-2001"]')
      ?.dispatchEvent(new Event('click'));
    tick();

    // The card had already fetched it to render the composition — no second `GET /boms/:id`.
    expect(openSpy).toHaveBeenCalledWith(BomFormDialog, {
      data: { mode: 'edit', bom: bom1, standardBoms, products },
    });
  });

  it('opens the delete confirmation from the detail card', async () => {
    const { fixture, httpMock, root } = await setUp();
    flushInitial(httpMock);
    await fixture.whenStable();

    const dialog = TestBed.inject(MatDialog);
    const openSpy = vi.spyOn(dialog, 'open').mockImplementation(
      (component) =>
        ({
          afterClosed: () => of(component === BomReportDetailDialog ? { action: 'delete' } : false),
        }) as MatDialogRef<unknown, unknown>,
    );

    root
      .querySelector<HTMLButtonElement>('[aria-label="جزئیات ORD-2001"]')
      ?.dispatchEvent(new Event('click'));
    tick();

    expect(openSpy).toHaveBeenCalledWith(ConfirmDeleteBomDialog, {
      data: { bom: { id: '1', orderNumber: 'ORD-2001' } },
    });
  });
  it('offers every write action to Management, as it does to the کنترلگر every other test uses', async () => {
    const { fixture, httpMock, root } = await setUp(Role.management);
    flushInitial(httpMock);
    await fixture.whenStable();

    expect(findButton(root, 'افزودن آنالیز روزانه')).toBeDefined();
    openRowMenu(root, 'ORD-2001');
    expect(menuItem('ویرایش')).toBeDefined();
    expect(menuItem('حذف')).toBeDefined();
  });

  it('withholds every write action from a Reporter, and the list from nobody', async () => {
    const { fixture, httpMock, root } = await setUp(Role.reporter);
    // Only the filter options: the standard BOMs and products feed the create/edit form, and a
    // Reporter never opens it.
    httpMock
      .expectOne({ method: 'GET', url: '/api/boms/report/filter-options' })
      .flush(filterOptions);
    httpMock.expectNone({ method: 'GET', url: '/api/standard-boms' });
    httpMock.expectNone({ method: 'GET', url: '/api/products' });
    expectReportRequest(httpMock).flush({ items: [row1], total: 1 });
    await fixture.whenStable();

    // Browsing carries no role restriction, so the list, the filters and the export all stay.
    expect(root.textContent).toContain('ORD-2001');
    expect(findButton(root, 'خروجی اکسل')).toBeDefined();
    expect(root.querySelector('[aria-label="جزئیات ORD-2001"]')).not.toBeNull();

    expect(findButton(root, 'افزودن آنالیز روزانه')).toBeUndefined();
    // The overflow menu stays for the id (any role may copy it) but offers no write action.
    openRowMenu(root, 'ORD-2001');
    expect(menuItem('کپی شناسه')).toBeDefined();
    expect(menuItem('ویرایش')).toBeUndefined();
    expect(menuItem('حذف')).toBeUndefined();
  });

  it('tells the detail card to hide the write actions from a Reporter too', async () => {
    const { fixture, httpMock, root } = await setUp(Role.reporter);
    httpMock
      .expectOne({ method: 'GET', url: '/api/boms/report/filter-options' })
      .flush(filterOptions);
    expectReportRequest(httpMock).flush({ items: [row1], total: 1 });
    await fixture.whenStable();

    const dialog = TestBed.inject(MatDialog);
    const openSpy = vi
      .spyOn(dialog, 'open')
      .mockReturnValue({ afterClosed: () => of(undefined) } as MatDialogRef<unknown, unknown>);

    root
      .querySelector<HTMLButtonElement>('[aria-label="جزئیات ORD-2001"]')
      ?.dispatchEvent(new Event('click'));

    expect(openSpy).toHaveBeenCalledWith(BomReportDetailDialog, {
      data: { id: '1', orderNumber: 'ORD-2001', canManage: false },
    });
  });

  it('copies a row id to the clipboard for every role, write actions or not', async () => {
    const { fixture, httpMock, root } = await setUp(Role.reporter);
    httpMock
      .expectOne({ method: 'GET', url: '/api/boms/report/filter-options' })
      .flush(filterOptions);
    expectReportRequest(httpMock).flush({ items: [row1], total: 1 });
    await fixture.whenStable();

    const copy = stubClipboard();

    chooseRowAction(root, 'ORD-2001', 'کپی شناسه');

    expect(copy).toHaveBeenCalledWith(row1.id);
  });
});
