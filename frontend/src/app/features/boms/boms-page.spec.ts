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
import { PersianPaginatorIntl } from '../../core/material/persian-paginator-intl';
import { XlsxDownloader } from '../../core/files/xlsx-downloader';
import { BomFormDialog } from './bom-form-dialog';
import { BomReportDetailDialog } from './bom-report-detail-dialog';
import { BomReportFilterDialog } from './bom-report-filter-dialog';
import { BomsPage } from './boms-page';
import { ConfirmDeleteBomDialog } from './confirm-delete-bom-dialog';

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
    ],
  });

  const httpMock = TestBed.inject(HttpTestingController);
  TestBed.inject(SessionStore).store('a-valid-token');
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
 * The two requests the page fires on load besides the report itself: the filter panel's distinct
 * values, and the standard BOMs the create/edit form's picker is built from.
 */
function flushSupportingRequests(httpMock: HttpTestingController): void {
  httpMock
    .expectOne({ method: 'GET', url: '/api/boms/report/filter-options' })
    .flush(filterOptions);
  httpMock.expectOne({ method: 'GET', url: '/api/standard-boms' }).flush(standardBoms);
}

function expectReportRequest(httpMock: HttpTestingController) {
  return httpMock.expectOne({ method: 'POST', url: '/api/boms/report' });
}

function flushInitial(httpMock: HttpTestingController, items = [row1], total = 1): void {
  flushSupportingRequests(httpMock);
  expectReportRequest(httpMock).flush({ items, total });
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
    expect(root.textContent).toContain('1403/04/01 08:30');
  });

  it('shows exactly the seven business columns the feature specifies, in order', async () => {
    const { fixture, httpMock, root } = await setUp();

    flushInitial(httpMock);
    await fixture.whenStable();

    const headers = Array.from(root.querySelectorAll('th')).map((th) => th.textContent?.trim());
    // The leading «کپی شناسه» is the copy-id column's screen-reader-only header, not a business
    // column: it holds no data and renders no visible text. It leads the row because dir="rtl" puts
    // the first column at the visual right edge.
    expect(headers).toEqual([
      'کپی شناسه',
      'شماره سفارش',
      'شماره ردیابی',
      'تاریخ و زمان ثبت',
      'کنترلگر',
      'کد MI',
      'برند',
      'نام محصول',
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

    findButton(root, 'فیلتر برند')?.dispatchEvent(new Event('click'));

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

    findButton(root, 'فیلتر برند')?.dispatchEvent(new Event('click'));
    tick();

    const request = expectReportRequest(httpMock);
    expect(request.request.body).toEqual({
      page: 1,
      pageSize: 20,
      filters: { brands: ['لگراند'] },
    });

    request.flush({ items: [row1], total: 1 });
  });

  it('applies a valid registered-at range as an ISO instant', async () => {
    const { fixture, httpMock, root } = await setUp();
    flushInitial(httpMock);
    await fixture.whenStable();

    const fromInput = Array.from(root.querySelectorAll('input')).find((input) =>
      input.closest('mat-form-field')?.textContent?.includes('از تاریخ و زمان ثبت'),
    ) as HTMLInputElement;
    fromInput.value = '1403/04/01 00:00';
    fromInput.dispatchEvent(new Event('input'));

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

  it('rejects a registered-at range typed in an unrecognised format, without sending a request', async () => {
    const { fixture, httpMock, root } = await setUp();
    flushInitial(httpMock);
    await fixture.whenStable();

    const fromInput = Array.from(root.querySelectorAll('input')).find((input) =>
      input.closest('mat-form-field')?.textContent?.includes('از تاریخ و زمان ثبت'),
    ) as HTMLInputElement;
    fromInput.value = 'not a date';
    fromInput.dispatchEvent(new Event('input'));

    const form = root.querySelector('form');
    form?.dispatchEvent(new Event('submit', { cancelable: true }));
    await fixture.whenStable();

    expect(root.querySelector('mat-error')?.textContent).toContain('قالب تاریخ و زمان معتبر نیست');
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

  it('exports the currently filtered list, using only the filters, to the chosen format', async () => {
    const { fixture, httpMock, root } = await setUp();
    flushInitial(httpMock);
    await fixture.whenStable();

    const downloader = TestBed.inject(XlsxDownloader);
    const downloadSpy = vi.spyOn(downloader, 'download').mockResolvedValue(undefined);

    // Apply a filter first — the export must respect it, and must never fall back to page/pageSize.
    const dialog = TestBed.inject(MatDialog);
    vi.spyOn(dialog, 'open').mockReturnValue({
      afterClosed: () => of({ selected: ['لگراند'] }),
    } as MatDialogRef<unknown, unknown>);
    findButton(root, 'فیلتر برند')?.dispatchEvent(new Event('click'));
    tick();
    expectReportRequest(httpMock).flush({ items: [row1], total: 1 });
    await fixture.whenStable();

    findButton(root, 'خروجی اکسل')?.dispatchEvent(new Event('click'));
    tick();
    document.body
      .querySelector<HTMLButtonElement>('.mat-mdc-menu-item')
      ?.dispatchEvent(new Event('click'));

    const request = httpMock.expectOne({ method: 'POST', url: '/api/boms/report/export' });
    expect(request.request.body).toEqual({ filters: { brands: ['لگراند'] } });

    request.flush({
      items: [
        {
          orderNumber: 'ORD-2001',
          trackingNumber: 'TRK-3001',
          registeredAt: '2024-06-21T08:30:00.000Z',
          registeredBy: 'نیکروش',
          standardBomMiCode: '1001',
          brand: 'لگراند',
          standardLength: 305,
          productName: 'کابل شبکه U/UTP 0.42 LEGRAND',
          description: 'بررسی کیفیت اولیه',
          components: [{ name: 'مغزی', materials: [{ name: 'مسی', weight: 10 }] }],
        },
      ],
    });
    await fixture.whenStable();

    expect(downloadSpy).toHaveBeenCalledWith(
      [
        [
          'شماره سفارش',
          'شماره ردیابی',
          'تاریخ و زمان ثبت',
          'کنترلگر',
          'کد MI',
          'برند',
          'متراژ استاندارد',
          'نام محصول',
          'توضیحات',
          'نام جز',
          'نام مواد اولیه',
          'وزن مواد اولیه',
        ],
        [
          'ORD-2001',
          'TRK-3001',
          '1403/04/01 08:30',
          'نیکروش',
          '1001',
          'لگراند',
          305,
          'کابل شبکه U/UTP 0.42 LEGRAND',
          'بررسی کیفیت اولیه',
          'مغزی',
          'مسی',
          10,
        ],
      ],
      'گزارش-آنالیز-های-روزانه.xlsx',
    );
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
      data: { mode: 'create', standardBoms },
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

    root
      .querySelector<HTMLButtonElement>('[aria-label="ویرایش ORD-2001"]')
      ?.dispatchEvent(new Event('click'));

    // The row itself carries neither the composition nor the standard BOM's id, so the form cannot
    // be opened from it.
    expect(openSpy).not.toHaveBeenCalled();

    httpMock.expectOne({ method: 'GET', url: '/api/boms/1' }).flush(bom1Detail);
    tick();

    expect(openSpy).toHaveBeenCalledWith(BomFormDialog, {
      data: { mode: 'edit', bom: bom1, standardBoms },
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

    root
      .querySelector<HTMLButtonElement>('[aria-label="ویرایش ORD-2001"]')
      ?.dispatchEvent(new Event('click'));

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

    root
      .querySelector<HTMLButtonElement>('[aria-label="حذف ORD-2001"]')
      ?.dispatchEvent(new Event('click'));

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
      data: { mode: 'edit', bom: bom1, standardBoms },
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
    expect(root.querySelector('[aria-label="ویرایش ORD-2001"]')).not.toBeNull();
    expect(root.querySelector('[aria-label="حذف ORD-2001"]')).not.toBeNull();
  });

  it('withholds every write action from a Reporter, and the list from nobody', async () => {
    const { fixture, httpMock, root } = await setUp(Role.reporter);
    // Only two requests, not three: the standard BOMs feed the create/edit form's picker, and a
    // Reporter never opens it.
    httpMock
      .expectOne({ method: 'GET', url: '/api/boms/report/filter-options' })
      .flush(filterOptions);
    httpMock.expectNone({ method: 'GET', url: '/api/standard-boms' });
    expectReportRequest(httpMock).flush({ items: [row1], total: 1 });
    await fixture.whenStable();

    // Browsing carries no role restriction, so the list, the filters and the export all stay.
    expect(root.textContent).toContain('ORD-2001');
    expect(findButton(root, 'خروجی اکسل')).toBeDefined();
    expect(root.querySelector('[aria-label="جزئیات ORD-2001"]')).not.toBeNull();

    expect(findButton(root, 'افزودن آنالیز روزانه')).toBeUndefined();
    expect(root.querySelector('[aria-label="ویرایش ORD-2001"]')).toBeNull();
    expect(root.querySelector('[aria-label="حذف ORD-2001"]')).toBeNull();
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

    root
      .querySelector<HTMLButtonElement>('[aria-label="کپی شناسه ORD-2001"]')
      ?.dispatchEvent(new Event('click'));

    expect(copy).toHaveBeenCalledWith(row1.id);
  });
});
