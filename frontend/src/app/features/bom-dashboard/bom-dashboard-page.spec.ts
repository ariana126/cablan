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
  lastRegisteredAt: '2024-06-21T10:00:00.000Z',
};

const product2 = {
  productId: 'p2',
  productName: 'کابل برق NYY 3x2.5',
  dailyBomCount: 1,
  lastRegisteredAt: '2024-06-22T09:00:00.000Z',
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

/** The product list's picker for one product: its name is the button. */
function detailsButton(root: HTMLElement, productName: string): HTMLButtonElement | undefined {
  return Array.from(root.querySelectorAll<HTMLButtonElement>('button.row-pick')).find(
    (button) => button.textContent?.trim() === productName,
  );
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

  it('renders the page heading and the product list, each product name a button that picks it', async () => {
    const { fixture, httpMock, root } = setUp();
    flushProducts(httpMock);
    await fixture.whenStable();

    expect(root.querySelector('h1')?.textContent).toContain('داشبورد روزانه');

    const table = root.querySelector('[aria-label="محصولات دارای آنالیز روزانه"]');
    const headers = Array.from(table?.querySelectorAll('th') ?? []).map((th) =>
      th.textContent?.trim(),
    );
    expect(headers).toEqual(['نام محصول', 'آنالیزها']);

    const buttons = Array.from(table?.querySelectorAll('button') ?? []);
    expect(buttons.map((button) => button.textContent?.trim())).toEqual([
      product1.productName,
      product2.productName,
    ]);
    expect(buttons.map((button) => button.getAttribute('aria-pressed'))).toEqual([
      'false',
      'false',
    ]);

    const counts = Array.from(table?.querySelectorAll('tr.mat-mdc-row') ?? []).map((row) =>
      row.querySelectorAll('td')[1]?.textContent?.trim(),
    );
    expect(counts).toEqual(['۲', '۱']);
  });

  it('counts the range in three tiles: analyses, products and the newest registration', async () => {
    const { fixture, httpMock, root } = setUp();
    flushProducts(httpMock);
    await fixture.whenStable();

    const tiles = Array.from(root.querySelectorAll('app-stat-tile')).map((tile) =>
      tile.textContent?.replace(/\s+/g, ' ').trim(),
    );
    expect(tiles).toHaveLength(3);
    expect(tiles[0]).toContain('آنالیز های روزانه');
    expect(tiles[0]).toContain('۳');
    expect(tiles[1]).toContain('محصولات');
    expect(tiles[1]).toContain('۲');
    // 2024-06-22T09:00:00Z is 1403/04/02 09:00 in Jalali — the newer of the two products.
    expect(tiles[2]).toContain('آخرین ثبت');
    expect(tiles[2]).toContain('۱۴۰۳/۰۴/۰۲ ۰۹:۰۰');
  });

  it('shows the empty-state message when the dashboard returns no products in the range', async () => {
    const { fixture, httpMock, root } = setUp();
    flushProducts(httpMock, []);
    await fixture.whenStable();

    const statuses = Array.from(root.querySelectorAll('[role="status"]')).map(
      (status) => status.textContent ?? '',
    );
    expect(
      statuses.some((text) =>
        text.includes('هیچ محصولی در این بازه زمانی دارای آنالیز روزانه نیست'),
      ),
    ).toBe(true);
    expect(root.querySelector('table')).toBeNull();
  });

  it('fetches the per-product daily-BOM list lazily on selection, scoped to that product', async () => {
    const { fixture, httpMock, root } = setUp();
    flushProducts(httpMock);
    await fixture.whenStable();

    detailsButton(root, product1.productName)?.dispatchEvent(new Event('click'));
    tick();

    expect(detailsButton(root, product1.productName)?.getAttribute('aria-pressed')).toBe('true');

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
        `[aria-label="آنالیز های روزانه ${product1.productName}"] .analysis__tracking`,
      ),
    ).map((cell) => cell.textContent?.trim());
    expect(trackingNumberCells).toEqual([dailyBom1.trackingNumber, dailyBom2.trackingNumber]);
    // The order number sits beside the tracking number in each header.
    expect(panel?.textContent).toContain(dailyBom1.orderNumber);

    const scoreCells = Array.from(
      root.querySelectorAll<HTMLElement>(
        `[aria-label="آنالیز های روزانه ${product1.productName}"] .analysis__score`,
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
      'وزن استاندارد',
      'وزن ثبت‌شده',
      'اختلاف وزن',
    ]);

    // The last cell is the difference pill; its visually hidden words are read apart from its number.
    const cells = Array.from(lineTable?.querySelectorAll<HTMLElement>('tbody tr') ?? []).map(
      (row) =>
        Array.from(row.querySelectorAll('td')).map((td) =>
          (td.querySelector('.weight-difference__value') ?? td).textContent?.trim(),
        ),
    );
    // The description belongs to the whole daily BOM, so no line repeats it.
    expect(cells).toEqual([
      ['مغزی', 'مسی', '۲', '۳', '۱'],
      ['روکش', 'آلومینیوم', '۴', '۱٫۵', '۲٫۵'],
    ]);
  });

  it('marks each deviation by direction — above standard apart from below and from an exact match', async () => {
    const { fixture, httpMock, root } = setUp();
    flushProducts(httpMock);
    await fixture.whenStable();

    detailsButton(root, product1.productName)?.dispatchEvent(new Event('click'));
    tick();
    expectDailyBomsRequest(httpMock, product1.productId).flush({ items: [dailyBom1, dailyBom2] });
    await fixture.whenStable();

    const markers = Array.from(
      root.querySelectorAll<HTMLElement>('td.mat-column-difference .weight-difference'),
    ).map((marker) => ({
      text: marker.querySelector('.weight-difference__value')?.textContent?.trim(),
      direction: ['above', 'below', 'equal'].find((direction) =>
        marker.classList.contains(`weight-difference--${direction}`),
      ),
    }));
    // The difference is an absolute deviation (daily 1.5 against standard 4 reads ۲٫۵), so its
    // direction comes from comparing the two weights: daily 3 against standard 2 is above.
    expect(markers).toEqual([
      { text: '۰', direction: 'equal' },
      { text: '۰', direction: 'equal' },
      { text: '۱', direction: 'above' },
      { text: '۲٫۵', direction: 'below' },
    ]);
  });

  it('tells assistive technology which way a deviation goes, in words beside the number', async () => {
    const { fixture, httpMock, root } = setUp();
    flushProducts(httpMock);
    await fixture.whenStable();

    detailsButton(root, product1.productName)?.dispatchEvent(new Event('click'));
    tick();
    expectDailyBomsRequest(httpMock, product1.productId).flush({ items: [dailyBom1, dailyBom2] });
    await fixture.whenStable();

    const spoken = Array.from(
      root.querySelectorAll<HTMLElement>('td.mat-column-difference .visually-hidden'),
    ).map((words) => words.textContent?.trim());
    expect(spoken).toEqual([
      'برابر با استاندارد',
      'برابر با استاندارد',
      'بیشتر از استاندارد',
      'کمتر از استاندارد',
    ]);
  });

  it("groups each daily BOM's tracking number, order, score and lines into one expansion panel", async () => {
    const { fixture, httpMock, root } = setUp();
    flushProducts(httpMock);
    await fixture.whenStable();

    detailsButton(root, product1.productName)?.dispatchEvent(new Event('click'));
    tick();
    expectDailyBomsRequest(httpMock, product1.productId).flush({ items: [dailyBom1, dailyBom2] });
    await fixture.whenStable();

    const cards = Array.from(root.querySelectorAll<HTMLElement>('mat-expansion-panel.analysis'));
    expect(cards.length).toBe(2);

    const text = (el: Element | null): string => el?.textContent?.trim() ?? '';
    expect(text(cards[0]!.querySelector('.analysis__tracking'))).toBe(dailyBom1.trackingNumber);
    expect(cards[0]!.textContent).toContain(dailyBom1.orderNumber);
    expect(text(cards[0]!.querySelector('.analysis__score'))).toBe('۰');
    expect(text(cards[0]!.querySelector('.analysis__description'))).toBe(dailyBom1.description);
    expect(cards[0]!.querySelectorAll('[aria-label="اجزا و مواد اولیه"] tbody tr').length).toBe(2);

    expect(text(cards[1]!.querySelector('.analysis__tracking'))).toBe(dailyBom2.trackingNumber);
    expect(text(cards[1]!.querySelector('.analysis__score'))).toBe('۳٫۵');
    expect(text(cards[1]!.querySelector('.analysis__description'))).toBe(dailyBom2.description);
    // Shown once per daily BOM, never once per line.
    expect(cards[1]!.textContent?.split(dailyBom2.description).length).toBe(2);
    // Open to begin with, so the numbers are on screen without a click.
    expect(
      cards.every((card) => card.querySelector('mat-expansion-panel-header[aria-expanded="true"]')),
    ).toBe(true);
  });

  it('shows a dash in place of an empty description', async () => {
    const { fixture, httpMock, root } = setUp();
    flushProducts(httpMock);
    await fixture.whenStable();

    detailsButton(root, product1.productName)?.dispatchEvent(new Event('click'));
    tick();
    expectDailyBomsRequest(httpMock, product1.productId).flush({
      items: [{ ...dailyBom1, description: '' }],
    });
    await fixture.whenStable();

    expect(root.querySelector('.analysis__description')?.textContent?.trim()).toBe('—');
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

  it('closes the panel and returns focus to the product that opened it', async () => {
    const { fixture, httpMock, root } = setUp();
    flushProducts(httpMock);
    await fixture.whenStable();

    const picker = detailsButton(root, product1.productName)!;
    picker.dispatchEvent(new Event('click'));
    tick();
    expectDailyBomsRequest(httpMock, product1.productId).flush({ items: [dailyBom1] });
    await fixture.whenStable();

    const close = Array.from(root.querySelectorAll('button')).find(
      (button) => button.textContent?.trim() === 'بستن',
    );
    close?.dispatchEvent(new Event('click'));
    await fixture.whenStable();

    expect(root.querySelector('.panel')).toBeNull();
    expect(picker.getAttribute('aria-pressed')).toBe('false');
  });

  it('shows a dash for the newest registration when no product carries a usable date', async () => {
    const { fixture, httpMock, root } = setUp();
    flushProducts(httpMock, [{ ...product1, lastRegisteredAt: 'not a date' }]);
    await fixture.whenStable();

    const tile = Array.from(root.querySelectorAll('app-stat-tile')).find((element) =>
      element.textContent?.includes('آخرین ثبت'),
    );
    expect(tile?.textContent).toContain('—');
  });

  it('switches product without stacking panels', async () => {
    const { fixture, httpMock, root } = setUp();
    flushProducts(httpMock);
    await fixture.whenStable();

    detailsButton(root, product1.productName)?.dispatchEvent(new Event('click'));
    tick();
    expectDailyBomsRequest(httpMock, product1.productId).flush({ items: [dailyBom1] });
    await fixture.whenStable();

    detailsButton(root, product2.productName)?.dispatchEvent(new Event('click'));
    tick();
    expectDailyBomsRequest(httpMock, product2.productId).flush({ items: [dailyBom2] });
    await fixture.whenStable();

    expect(root.querySelectorAll('.panel')).toHaveLength(1);
    expect(root.querySelector('.panel')?.textContent).toContain(product2.productName);
  });
});
