import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ApplicationRef } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { afterEach, describe, expect, it } from 'vitest';

import { provideJalaliDateAdapter } from '../../core/material/jalali-date-adapter';
import { BomDashboardPage } from './bom-dashboard-page';

const product1 = {
  productId: 'p1',
  productName: 'کابل شبکه U/UTP 0.42 LEGRAND',
  dailyBomCount: 2,
};

const product2 = {
  productId: 'p2',
  productName: 'کابل برق NYY 3x2.5',
  dailyBomCount: 1,
};

const dailyBom1 = {
  id: '1',
  orderNumber: 'ORD-5001',
  trackingNumber: 'TRK-6001',
  registeredAt: '2024-06-21T08:30:00.000Z',
  description: 'بررسی کیفیت اولیه',
  score: 0,
  lines: [
    {
      componentName: 'مغزی',
      materialName: 'مسی',
      actualWeight: 2,
      standardWeight: 2,
      difference: 0,
    },
    {
      componentName: 'روکش',
      materialName: 'آلومینیوم',
      actualWeight: 4,
      standardWeight: 4,
      difference: 0,
    },
  ],
};

const dailyBom2 = {
  id: '2',
  orderNumber: 'ORD-5002',
  trackingNumber: 'TRK-6002',
  registeredAt: '2024-06-21T10:00:00.000Z',
  description: 'نوسان دستگاه شماره ۲',
  score: 3.5,
  lines: [
    {
      componentName: 'مغزی',
      materialName: 'مسی',
      actualWeight: 3,
      standardWeight: 2,
      difference: 1,
    },
    {
      componentName: 'روکش',
      materialName: 'آلومینیوم',
      actualWeight: 1.5,
      standardWeight: 4,
      difference: 2.5,
    },
  ],
};

function setUp() {
  TestBed.configureTestingModule({
    providers: [
      provideHttpClient(),
      provideHttpClientTesting(),
      provideRouter([]),
      provideJalaliDateAdapter(),
    ],
  });

  const fixture = TestBed.createComponent(BomDashboardPage);
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

function expectProductsRequest(httpMock: HttpTestingController) {
  return httpMock.expectOne({ method: 'POST', url: '/api/boms/dashboard' });
}

function expectDailyBomsRequest(httpMock: HttpTestingController, productId: string) {
  return httpMock.expectOne({
    method: 'POST',
    url: `/api/boms/dashboard/${productId}/daily-boms`,
  });
}

function flushProducts(httpMock: HttpTestingController, items = [product1, product2]): void {
  expectProductsRequest(httpMock).flush({ items });
}

function detailsButton(root: HTMLElement, productName: string): HTMLButtonElement | null {
  return root.querySelector<HTMLButtonElement>(`button[aria-label="جزئیات ${productName}"]`);
}

/**
 * Material's picker inputs listen for `input`; `blur` settles the parse state. The `whenStable`
 * matters between one field and the next: the clock reads the date already in the model to decide
 * which day it is setting the time on, and it only learns that through `writeValue` on the next
 * change-detection pass. Typing all four synchronously would leave the clock stamping today.
 */
const typeInto = async (
  fixture: ComponentFixture<BomDashboardPage>,
  input: HTMLInputElement,
  text: string,
): Promise<void> => {
  input.value = text;
  input.dispatchEvent(new Event('input'));
  input.dispatchEvent(new Event('blur'));
  await fixture.whenStable();
};

describe('BomDashboardPage', () => {
  afterEach(() => {
    TestBed.inject(HttpTestingController).verify();
  });

  it('shows a loading indicator before the product list arrives', () => {
    const { httpMock, root } = setUp();

    expect(root.querySelector('mat-progress-bar')).not.toBeNull();

    flushProducts(httpMock);
  });

  it('requests the product list with no range fields when no date range is applied', () => {
    const { httpMock } = setUp();

    const request = expectProductsRequest(httpMock);
    expect(request.request.body).toEqual({});
    expect(Object.prototype.hasOwnProperty.call(request.request.body, 'from')).toBe(false);
    expect(Object.prototype.hasOwnProperty.call(request.request.body, 'to')).toBe(false);

    request.flush({ items: [product1] });
  });

  it('renders the page heading and the product list with a details button per row', async () => {
    const { fixture, httpMock, root } = setUp();
    flushProducts(httpMock);
    await fixture.whenStable();

    expect(root.querySelector('h1')?.textContent).toContain('داشبورد بررسی روزانه آنالیز ها');

    const headers = Array.from(root.querySelectorAll('th')).map((th) => th.textContent?.trim());
    expect(headers).toEqual(['نام محصول', 'تعداد آنالیز روزانه', 'عملیات']);

    // Like every other list, each row's button reads "جزئیات" and is told apart by its accessible
    // name, "جزئیات <productName>"; the product name itself stays visible as a plain cell.
    const table = root.querySelector('[aria-label="محصولات دارای آنالیز روزانه"]');
    const buttons = Array.from(table?.querySelectorAll('button') ?? []);
    expect(buttons.map((button) => button.textContent?.trim())).toEqual(['جزئیات', 'جزئیات']);
    expect(buttons.map((button) => button.getAttribute('aria-label'))).toEqual([
      `جزئیات ${product1.productName}`,
      `جزئیات ${product2.productName}`,
    ]);

    const rows = Array.from(table?.querySelectorAll('tr.mat-mdc-row') ?? []);
    expect(rows.map((row) => row.querySelector('td')?.textContent?.trim())).toEqual([
      product1.productName,
      product2.productName,
    ]);
  });

  it('shows the empty-state message when the dashboard returns no products in the range', async () => {
    const { fixture, httpMock, root } = setUp();
    flushProducts(httpMock, []);
    await fixture.whenStable();

    const status = root.querySelector('[role="status"]');
    expect(status?.textContent).toContain('هیچ محصولی در این بازه زمانی دارای آنالیز روزانه نیست');
    expect(root.querySelector('table')).toBeNull();
  });

  it('fetches the per-product daily-BOM list lazily on selection, scoped to that product', async () => {
    const { fixture, httpMock, root } = setUp();
    flushProducts(httpMock);
    await fixture.whenStable();

    detailsButton(root, product1.productName)?.dispatchEvent(new Event('click'));
    tick();

    const request = expectDailyBomsRequest(httpMock, product1.productId);
    expect(request.request.body).toEqual({});

    request.flush({ items: [dailyBom1, dailyBom2] });
    await fixture.whenStable();

    // The per-product panel wraps the BOM list in a section whose aria-label is the dispatch's
    // "آنالیز های روزانه <productName>" — the QA page object's `productPanel` anchor.
    const panel = root.querySelector(`[aria-label="آنالیز های روزانه ${product1.productName}"]`);
    expect(panel).not.toBeNull();

    const trackingNumberCells = Array.from(
      root.querySelectorAll<HTMLElement>(
        `[aria-label="آنالیز های روزانه ${product1.productName}"] td.mat-column-trackingNumber`,
      ),
    ).map((cell) => cell.textContent?.trim());
    expect(trackingNumberCells).toEqual([dailyBom1.trackingNumber, dailyBom2.trackingNumber]);
    expect(panel?.textContent).not.toContain(dailyBom1.orderNumber);

    const scoreCells = Array.from(
      root.querySelectorAll<HTMLElement>(
        `[aria-label="آنالیز های روزانه ${product1.productName}"] .mat-mdc-row td.mat-column-score`,
      ),
    ).map((cell) => cell.textContent?.trim());
    // Scores are quantities, so they read in Persian numerals; the tracking numbers above are codes
    // and stay Latin — see core/i18n/persian-numerals.ts.
    expect(scoreCells).toEqual(['۰', '۳٫۵']);
  });

  it('renders each line beside its standard weight and how far the two lie apart', async () => {
    const { fixture, httpMock, root } = setUp();
    flushProducts(httpMock);
    await fixture.whenStable();

    detailsButton(root, product1.productName)?.dispatchEvent(new Event('click'));
    tick();
    expectDailyBomsRequest(httpMock, product1.productId).flush({ items: [dailyBom2] });
    await fixture.whenStable();

    const lineTable = root.querySelector(
      `[aria-label="آنالیز های روزانه ${product1.productName}"] [aria-label="اجزا و مواد اولیه"]`,
    );
    const headers = Array.from(lineTable?.querySelectorAll('thead th') ?? []).map((th) =>
      th.textContent?.trim(),
    );
    expect(headers).toEqual([
      'نام جز',
      'نام مواد اولیه',
      'وزن استاندارد مواد اولیه',
      'وزن مواد اولیه',
      'اختلاف وزن',
      'توضیحات',
    ]);

    const cells = Array.from(lineTable?.querySelectorAll<HTMLElement>('tbody tr') ?? []).map(
      (row) => Array.from(row.querySelectorAll('td')).map((td) => td.textContent?.trim()),
    );
    expect(cells).toEqual([
      ['مغزی', 'مسی', '۲', '۳', '۱', 'نوسان دستگاه شماره ۲'],
      ['روکش', 'آلومینیوم', '۴', '۱٫۵', '۲٫۵', 'نوسان دستگاه شماره ۲'],
    ]);
  });

  it('flags any deviation from standard, and leaves an exact match unflagged', async () => {
    const { fixture, httpMock, root } = setUp();
    flushProducts(httpMock);
    await fixture.whenStable();

    detailsButton(root, product1.productName)?.dispatchEvent(new Event('click'));
    tick();
    expectDailyBomsRequest(httpMock, product1.productId).flush({ items: [dailyBom1, dailyBom2] });
    await fixture.whenStable();

    const markers = Array.from(
      root.querySelectorAll<HTMLElement>('td.mat-column-difference .difference'),
    ).map((marker) => ({
      text: marker.textContent?.trim(),
      deviates: marker.classList.contains('difference--deviates'),
    }));
    // The difference is an absolute deviation (daily 1.5 against standard 4 reads ۲٫۵), so any
    // non-zero value is flagged alike and an exact match is not.
    expect(markers).toEqual([
      { text: '۰', deviates: false },
      { text: '۰', deviates: false },
      { text: '۱', deviates: true },
      { text: '۲٫۵', deviates: true },
    ]);
  });

  it("groups each daily BOM's tracking number, score and lines into one card", async () => {
    const { fixture, httpMock, root } = setUp();
    flushProducts(httpMock);
    await fixture.whenStable();

    detailsButton(root, product1.productName)?.dispatchEvent(new Event('click'));
    tick();
    expectDailyBomsRequest(httpMock, product1.productId).flush({ items: [dailyBom1, dailyBom2] });
    await fixture.whenStable();

    const cards = Array.from(root.querySelectorAll<HTMLElement>('.daily-bom'));
    expect(cards.length).toBe(2);

    const text = (el: Element | null): string => el?.textContent?.trim() ?? '';
    expect(text(cards[0]!.querySelector('td.mat-column-trackingNumber'))).toBe(
      dailyBom1.trackingNumber,
    );
    expect(
      cards[0]!.querySelector(`[aria-label="شماره ردیابی و امتیاز ${dailyBom1.trackingNumber}"]`),
    ).not.toBeNull();
    expect(
      Array.from(cards[0]!.querySelectorAll('.daily-bom-header th')).map((th) => text(th)),
    ).toEqual(['شماره ردیابی', 'امتیاز']);
    expect(text(cards[0]!.querySelector('td.mat-column-score'))).toBe('۰');
    expect(cards[0]!.querySelectorAll('[aria-label="اجزا و مواد اولیه"] tbody tr').length).toBe(2);

    expect(text(cards[1]!.querySelector('td.mat-column-trackingNumber'))).toBe(
      dailyBom2.trackingNumber,
    );
    expect(text(cards[1]!.querySelector('td.mat-column-score'))).toBe('۳٫۵');
    expect(cards[1]!.textContent).toContain(dailyBom2.description);
    // One header row per card — the tracking number is never listed apart from its lines.
    expect(cards[1]!.querySelectorAll('.mat-mdc-row').length).toBe(1);
  });

  it('applies a valid date range as ISO instants on the next fetch', async () => {
    const { fixture, httpMock, root } = setUp();
    flushProducts(httpMock);
    await fixture.whenStable();

    // Four inputs now, not two: each bound is a calendar field followed by a clock field.
    const [fromDate, fromTime, toDate, toTime] = Array.from(
      root.querySelectorAll('input'),
    ) as HTMLInputElement[];
    await typeInto(fixture, fromDate, '1403/04/01');
    await typeInto(fixture, fromTime, '00:00');
    await typeInto(fixture, toDate, '1403/04/01');
    await typeInto(fixture, toTime, '23:59');

    const form = root.querySelector('form');
    form?.dispatchEvent(new Event('submit', { cancelable: true }));
    tick();

    const request = expectProductsRequest(httpMock);
    expect(request.request.body).toEqual({
      from: '2024-06-21T00:00:00.000Z',
      to: '2024-06-21T23:59:00.000Z',
    });

    request.flush({ items: [product1] });
  });

  it('rejects a date range typed in an unrecognised format, without sending a request', async () => {
    const { fixture, httpMock, root } = setUp();
    flushProducts(httpMock);
    await fixture.whenStable();

    const fromDate = root.querySelectorAll('input')[0] as HTMLInputElement;
    await typeInto(fixture, fromDate, 'not a date');

    const form = root.querySelector('form');
    form?.dispatchEvent(new Event('submit', { cancelable: true }));
    await fixture.whenStable();

    expect(root.querySelector('mat-error')?.textContent).toContain('قالب تاریخ و زمان معتبر نیست');
    httpMock.expectNone(() => true);
  });
});
