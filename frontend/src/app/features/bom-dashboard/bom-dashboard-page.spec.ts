import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ApplicationRef } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { afterEach, describe, expect, it } from 'vitest';

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
  registeredAt: '2024-06-21T08:30:00.000Z',
  description: 'بررسی کیفیت اولیه',
  score: 0,
  lines: [
    { componentName: 'مغزی', materialName: 'مسی', actualWeight: 2, standardWeight: 2 },
    { componentName: 'روکش', materialName: 'آلومینیوم', actualWeight: 4, standardWeight: 4 },
  ],
};

const dailyBom2 = {
  id: '2',
  orderNumber: 'ORD-5002',
  registeredAt: '2024-06-21T10:00:00.000Z',
  description: 'نوسان دستگاه شماره ۲',
  score: 3,
  lines: [
    { componentName: 'مغزی', materialName: 'مسی', actualWeight: 3, standardWeight: 2 },
    { componentName: 'روکش', materialName: 'آلومینیوم', actualWeight: 6, standardWeight: 4 },
  ],
};

function setUp() {
  TestBed.configureTestingModule({
    providers: [provideHttpClient(), provideHttpClientTesting(), provideRouter([])],
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

function findButton(root: HTMLElement, text: string): HTMLButtonElement | undefined {
  return Array.from(root.querySelectorAll('button')).find(
    (button) => button.textContent?.trim() === text,
  );
}

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

  it('renders the page heading and the product list with a select button per row', async () => {
    const { fixture, httpMock, root } = setUp();
    flushProducts(httpMock);
    await fixture.whenStable();

    expect(root.querySelector('h1')?.textContent).toContain('داشبورد بررسی روزانه آنالیز ها');

    const headers = Array.from(root.querySelectorAll('th')).map((th) => th.textContent?.trim());
    expect(headers).toEqual(['نام محصول', 'تعداد آنالیز روزانه', 'عملیات']);

    // Each product row carries a button whose accessible name is exactly the product name — the
    // acceptance suite's `productSelectButton(productName)` locator relies on it.
    const selectButtons = root.querySelectorAll(
      '[aria-label="محصولات دارای آنالیز روزانه"] button',
    );
    expect(selectButtons.length).toBe(2);
    expect(selectButtons[0]?.textContent?.trim()).toBe(product1.productName);
    expect(selectButtons[1]?.textContent?.trim()).toBe(product2.productName);
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

    findButton(root, product1.productName)?.dispatchEvent(new Event('click'));
    tick();

    const request = expectDailyBomsRequest(httpMock, product1.productId);
    expect(request.request.body).toEqual({});

    request.flush({ items: [dailyBom1, dailyBom2] });
    await fixture.whenStable();

    // The per-product panel wraps the BOM list in a section whose aria-label is the dispatch's
    // "آنالیز های روزانه <productName>" — the QA page object's `productPanel` anchor.
    const panel = root.querySelector(`[aria-label="آنالیز های روزانه ${product1.productName}"]`);
    expect(panel).not.toBeNull();

    const orderNumberCells = Array.from(
      root.querySelectorAll<HTMLElement>(
        `[aria-label="آنالیز های روزانه ${product1.productName}"] .mat-mdc-row td:first-child`,
      ),
    ).map((cell) => cell.textContent?.trim());
    expect(orderNumberCells).toEqual([dailyBom1.orderNumber, dailyBom2.orderNumber]);

    const scoreCells = Array.from(
      root.querySelectorAll<HTMLElement>(
        `[aria-label="آنالیز های روزانه ${product1.productName}"] .mat-mdc-row td.mat-column-score`,
      ),
    ).map((cell) => cell.textContent?.trim());
    expect(scoreCells).toEqual([String(dailyBom1.score), String(dailyBom2.score)]);
  });

  it('renders the per-line composition with the four-column order the suite asserts against', async () => {
    const { fixture, httpMock, root } = setUp();
    flushProducts(httpMock);
    await fixture.whenStable();

    findButton(root, product1.productName)?.dispatchEvent(new Event('click'));
    tick();
    expectDailyBomsRequest(httpMock, product1.productId).flush({ items: [dailyBom2] });
    await fixture.whenStable();

    const lineTable = root.querySelector(
      `[aria-label="آنالیز های روزانه ${product1.productName}"] [aria-label="اجزا و مواد اولیه"]`,
    );
    expect(lineTable).not.toBeNull();

    // The four-column order is the QA's contract (component, material, actual weight, description).
    const lineRows = Array.from(lineTable?.querySelectorAll<HTMLElement>('tbody tr') ?? []);
    expect(lineRows.length).toBe(2);
    const cellsOf = (row: HTMLElement, index: number): string =>
      row.querySelectorAll('td')[index]?.textContent?.trim() ?? '';
    expect(cellsOf(lineRows[0]!, 0)).toBe('مغزی');
    expect(cellsOf(lineRows[0]!, 1)).toBe('مسی');
    expect(cellsOf(lineRows[0]!, 2)).toBe('3');
    expect(cellsOf(lineRows[0]!, 3)).toBe('نوسان دستگاه شماره ۲');
  });

  it('applies a valid date range as ISO instants on the next fetch', async () => {
    const { fixture, httpMock, root } = setUp();
    flushProducts(httpMock);
    await fixture.whenStable();

    const inputs = root.querySelectorAll('input');
    const fromInput = inputs[0] as HTMLInputElement;
    const toInput = inputs[1] as HTMLInputElement;
    fromInput.value = '1403/04/01 00:00';
    fromInput.dispatchEvent(new Event('input'));
    toInput.value = '1403/04/01 23:59';
    toInput.dispatchEvent(new Event('input'));

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

    const fromInput = root.querySelectorAll('input')[0] as HTMLInputElement;
    fromInput.value = 'not a date';
    fromInput.dispatchEvent(new Event('input'));

    const form = root.querySelector('form');
    form?.dispatchEvent(new Event('submit', { cancelable: true }));
    await fixture.whenStable();

    expect(root.querySelector('mat-error')?.textContent).toContain('قالب تاریخ و زمان معتبر نیست');
  });
});
