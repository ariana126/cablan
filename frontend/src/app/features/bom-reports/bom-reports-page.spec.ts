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
import { XlsxDownloader } from '../../core/files/xlsx-downloader';
import { SessionStore } from '../../core/identity/session-store';
import { BomReportDetailDialog } from './bom-report-detail-dialog';
import { BomReportFilterDialog } from './bom-report-filter-dialog';
import { BomReportsPage } from './bom-reports-page';

const filterOptions = {
  brands: ['لگراند', 'نگزنس'],
  componentNames: ['مغزی', 'روکش'],
  standardBomMiCodes: ['1001', '1002'],
  productNames: ['کابل شبکه U/UTP 0.42 LEGRAND'],
  registeredByUsers: ['نیکروش', 'مصطفی'],
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

function setUp() {
  TestBed.configureTestingModule({
    providers: [
      provideHttpClient(),
      provideHttpClientTesting(),
      provideRouter([]),
      { provide: MatPaginatorIntl, useClass: PersianPaginatorIntl },
    ],
  });

  const fixture = TestBed.createComponent(BomReportsPage);
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

function flushFilterOptions(httpMock: HttpTestingController): void {
  httpMock
    .expectOne({ method: 'GET', url: '/api/boms/report/filter-options' })
    .flush(filterOptions);
}

function expectReportRequest(httpMock: HttpTestingController) {
  return httpMock.expectOne({ method: 'POST', url: '/api/boms/report' });
}

function flushInitial(httpMock: HttpTestingController, items = [row1], total = 1): void {
  flushFilterOptions(httpMock);
  expectReportRequest(httpMock).flush({ items, total });
}

function findButton(root: HTMLElement, text: string): HTMLButtonElement | undefined {
  return Array.from(root.querySelectorAll('button')).find(
    (button) => button.textContent?.trim() === text,
  );
}

describe('BomReportsPage', () => {
  afterEach(() => {
    TestBed.inject(HttpTestingController).verify();
  });

  it('shows a loading indicator before the report arrives', () => {
    const { httpMock, root } = setUp();

    expect(root.querySelector('mat-progress-bar')).not.toBeNull();

    flushInitial(httpMock);
  });

  it('requests the first page with every filter field left unset', () => {
    const { httpMock } = setUp();

    flushFilterOptions(httpMock);
    const request = expectReportRequest(httpMock);
    // An empty `filters` object is exactly as unfiltered as an absent one — every field inside it
    // is what the backend actually branches on (`BomReportGateway`'s own spec proves the per-field
    // omission this depends on).
    expect(request.request.body).toEqual({ page: 1, pageSize: 20, filters: {} });

    request.flush({ items: [row1], total: 1 });
  });

  it('renders every row, with the registered-at instant shown as Jalali text', async () => {
    const { fixture, httpMock, root } = setUp();

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
    const { fixture, httpMock, root } = setUp();

    flushInitial(httpMock);
    await fixture.whenStable();

    const headers = Array.from(root.querySelectorAll('th')).map((th) => th.textContent?.trim());
    expect(headers).toEqual([
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
    const { fixture, httpMock, root } = setUp();

    flushInitial(httpMock, [], 0);
    await fixture.whenStable();

    expect(root.textContent).toContain('هیچ آنالیز روزانه‌ای یافت نشد');
  });

  it('shows a generic error and a retry button when the report fails to load', async () => {
    const { fixture, httpMock, root } = setUp();

    flushFilterOptions(httpMock);
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
    const { fixture, httpMock, root } = setUp();

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
    const { fixture, httpMock, root } = setUp();
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
    const { fixture, httpMock, root } = setUp();
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
    const { fixture, httpMock, root } = setUp();
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
    const { fixture, httpMock, root } = setUp();
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
    const { fixture, httpMock, root } = setUp();
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
      data: { id: '1', orderNumber: 'ORD-2001' },
    });
  });

  it('exports the currently filtered list, using only the filters, to the chosen format', async () => {
    const { fixture, httpMock, root } = setUp();
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
