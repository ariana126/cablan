import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ApplicationRef } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { MediaMatcher } from '@angular/cdk/layout';
import { MatDialog, MatDialogRef } from '@angular/material/dialog';
import { of } from 'rxjs';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { Role } from '../../api/model';
import { CurrentUserStore } from '../../core/identity/current-user-store';
import { SessionStore } from '../../core/identity/session-store';
import { fakeAccessToken } from '../../core/identity/testing/fake-access-token';
import { provideJalaliDateAdapter } from '../../core/material/jalali-date-adapter';
import { CheckboxFilterDialog } from '../../ui/checkbox-filter-dialog/checkbox-filter-dialog';
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
  registeredBy: 'نیکروش',
  description: 'بررسی کیفیت اولیه',
  standardBomMiCode: '1001',
  approvalStatus: 'approved',
  approvedBy: 'مصطفی',
  score: 0,
  lines: [
    {
      componentId: 'c1',
      componentName: 'مغزی',
      materialId: 'm1',
      materialName: 'مسی',
      actualWeight: 2,
      standardWeight: 2,
      difference: 0,
    },
    {
      componentId: 'c2',
      componentName: 'روکش',
      materialId: 'm2',
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
  registeredBy: 'رضایی',
  description: 'نوسان دستگاه شماره ۲',
  standardBomMiCode: '1001',
  approvalStatus: 'unapproved',
  approvedBy: null,
  score: 3.5,
  lines: [
    {
      componentId: 'c1',
      componentName: 'مغزی',
      materialId: 'm1',
      materialName: 'مسی',
      actualWeight: 3,
      standardWeight: 2,
      difference: 1,
    },
    {
      componentId: 'c2',
      componentName: 'روکش',
      materialId: 'm2',
      materialName: 'آلومینیوم',
      actualWeight: 1.5,
      standardWeight: 4,
      difference: 2.5,
    },
  ],
};

/** Stands in for the browser's `matchMedia`, answering only the reduced-motion query. */
function mediaMatcherPreferring(reducedMotion: boolean): Pick<MediaMatcher, 'matchMedia'> {
  return {
    matchMedia: (query: string) =>
      ({
        matches: reducedMotion && query.includes('prefers-reduced-motion: reduce'),
      }) as MediaQueryList,
  };
}

function configure(reducedMotion: boolean): void {
  TestBed.configureTestingModule({
    providers: [
      provideHttpClient(),
      provideHttpClientTesting(),
      provideRouter([]),
      provideJalaliDateAdapter(),
      { provide: MediaMatcher, useValue: mediaMatcherPreferring(reducedMotion) },
    ],
  });
}

function setUp({ reducedMotion = false }: { reducedMotion?: boolean } = {}) {
  configure(reducedMotion);
  return createPage();
}

/** Renders the page for a signed-in user of `role`, resolved first, as `guardedRoute` does. */
async function setUpAs(role: Role) {
  localStorage.clear();
  configure(false);
  const httpMock = TestBed.inject(HttpTestingController);
  TestBed.inject(SessionStore).store(fakeAccessToken());
  const pending = TestBed.inject(CurrentUserStore).load();
  httpMock
    .expectOne({ method: 'GET', url: '/api/users/me' })
    .flush({ id: '1', name: 'مصطفی', username: 'mostafa', role });
  await pending;
  return createPage();
}

function createPage() {
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
  // jsdom lays nothing out, so it has no `scrollIntoView`; record the calls instead.
  const scrollIntoView = vi.fn();

  beforeEach(() => {
    scrollIntoView.mockReset();
    Element.prototype.scrollIntoView = scrollIntoView;
  });

  afterEach(() => {
    TestBed.inject(HttpTestingController).verify();
    delete (Element.prototype as Partial<Element>).scrollIntoView;
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

    const tiles = Array.from(root.querySelectorAll('app-stat-tile')).map((tile) => ({
      label: tile.querySelector('.stat-tile__label')?.textContent?.trim(),
      value: tile.querySelector('.stat-tile__value')?.textContent?.trim(),
      note: tile.querySelector('.stat-tile__note'),
    }));
    // Each label says in full what is counted and over what range, so no tile needs a note.
    expect(tiles).toEqual([
      { label: 'تعداد آنالیز روزانه ثبت شده در بازه انتخاب شده', value: '۳', note: null },
      { label: 'تعداد محصول آنالیز شده در بازه انتخاب شده', value: '۲', note: null },
      // 2024-06-22T09:00:00Z is 1403/04/02 09:00 in Jalali — the newer of the two products.
      { label: 'آخرین ثبت', value: '۱۴۰۳/۰۴/۰۲ ۰۹:۰۰', note: null },
    ]);
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

    const orderNumberCells = Array.from(
      root.querySelectorAll<HTMLElement>(
        `[aria-label="آنالیز های روزانه ${product1.productName}"] .analysis__order-number`,
      ),
    ).map((cell) => cell.textContent?.trim());
    expect(orderNumberCells).toEqual([dailyBom1.orderNumber, dailyBom2.orderNumber]);
    // The tracking number is no longer shown anywhere on the dashboard.
    expect(panel?.textContent).not.toContain(dailyBom1.trackingNumber);
  });

  it('keeps the order the API sends — highest score first — without showing the score', async () => {
    const { fixture, httpMock, root } = setUp();
    flushProducts(httpMock);
    await fixture.whenStable();

    detailsButton(root, product1.productName)?.dispatchEvent(new Event('click'));
    tick();
    expectDailyBomsRequest(httpMock, product1.productId).flush({ items: [dailyBom2, dailyBom1] });
    await fixture.whenStable();

    const panel = root.querySelector(`[aria-label="آنالیز های روزانه ${product1.productName}"]`);
    const orderNumbers = Array.from(
      panel?.querySelectorAll<HTMLElement>('.analysis__order-number') ?? [],
    ).map((cell) => cell.textContent?.trim());
    expect(orderNumbers).toEqual([dailyBom2.orderNumber, dailyBom1.orderNumber]);
    expect(panel?.textContent).not.toContain('امتیاز');
    expect(panel?.querySelector('.analysis__score')).toBeNull();
  });

  it('names the quality-control operator who registered each daily BOM in its header', async () => {
    const { fixture, httpMock, root } = setUp();
    flushProducts(httpMock);
    await fixture.whenStable();

    detailsButton(root, product1.productName)?.dispatchEvent(new Event('click'));
    tick();
    expectDailyBomsRequest(httpMock, product1.productId).flush({ items: [dailyBom1, dailyBom2] });
    await fixture.whenStable();

    const headers = Array.from(root.querySelectorAll<HTMLElement>('mat-expansion-panel-header'));
    expect(
      headers.map((header) => header.querySelector('.analysis__operator')?.textContent?.trim()),
    ).toEqual([dailyBom1.registeredBy, dailyBom2.registeredBy]);
    const operatorLabel = headers[0]!.querySelector('.analysis__operator')?.previousElementSibling;
    expect(operatorLabel?.textContent?.trim()).toBe('اپراتور کنترل کیفیت');
  });

  it('shows a dash when the operator is not known', async () => {
    const { fixture, httpMock, root } = setUp();
    flushProducts(httpMock);
    await fixture.whenStable();

    detailsButton(root, product1.productName)?.dispatchEvent(new Event('click'));
    tick();
    expectDailyBomsRequest(httpMock, product1.productId).flush({
      items: [{ ...dailyBom1, registeredBy: '' }],
    });
    await fixture.whenStable();

    expect(root.querySelector('.analysis__operator')?.textContent?.trim()).toBe('—');
  });

  it("scrolls the page to the product's analyses once they arrive, and moves focus to their heading", async () => {
    const { fixture, httpMock, root } = setUp();
    flushProducts(httpMock);
    await fixture.whenStable();

    detailsButton(root, product1.productName)?.dispatchEvent(new Event('click'));
    tick();
    // While the panel holds only its progress bar the page can be too short to bring it to the top.
    expect(scrollIntoView).not.toHaveBeenCalled();

    expectDailyBomsRequest(httpMock, product1.productId).flush({ items: [dailyBom1] });
    await fixture.whenStable();

    const panel = root.querySelector(`[aria-label="آنالیز های روزانه ${product1.productName}"]`);
    expect(scrollIntoView).toHaveBeenCalledOnce();
    expect(scrollIntoView.mock.contexts[0]).toBe(panel);
    expect(scrollIntoView).toHaveBeenCalledWith({ behavior: 'smooth', block: 'start' });
    expect(document.activeElement).toBe(panel?.querySelector('.panel__title'));
  });

  it('jumps rather than glides to the analyses when the visitor prefers reduced motion', async () => {
    const { fixture, httpMock, root } = setUp({ reducedMotion: true });
    flushProducts(httpMock);
    await fixture.whenStable();

    detailsButton(root, product1.productName)?.dispatchEvent(new Event('click'));
    tick();
    expectDailyBomsRequest(httpMock, product1.productId).flush({ items: [dailyBom1] });
    await fixture.whenStable();

    expect(scrollIntoView).toHaveBeenCalledWith({ behavior: 'instant', block: 'start' });
  });

  it("groups each daily BOM's order number, operator, description and lines into one expansion panel", async () => {
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
    expect(text(cards[0]!.querySelector('.analysis__order-number'))).toBe(dailyBom1.orderNumber);
    expect(text(cards[0]!.querySelector('.analysis__operator'))).toBe(dailyBom1.registeredBy);
    expect(text(cards[0]!.querySelector('.analysis__description'))).toBe(dailyBom1.description);
    expect(cards[0]!.querySelectorAll('[aria-label="اجزا و مواد اولیه"] tbody tr').length).toBe(2);

    expect(text(cards[1]!.querySelector('.analysis__order-number'))).toBe(dailyBom2.orderNumber);
    expect(text(cards[1]!.querySelector('.analysis__operator'))).toBe(dailyBom2.registeredBy);
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

  describe("the product panel's approval filters", () => {
    async function openProduct1() {
      const page = setUp();
      flushProducts(page.httpMock);
      await page.fixture.whenStable();
      detailsButton(page.root, product1.productName)?.dispatchEvent(new Event('click'));
      tick();
      expectDailyBomsRequest(page.httpMock, product1.productId).flush({
        items: [dailyBom1, dailyBom2],
      });
      await page.fixture.whenStable();
      return page;
    }

    const panelSelector = `[aria-label="آنالیز های روزانه ${product1.productName}"]`;

    function panelFilterButton(root: HTMLElement, field: string) {
      return root.querySelector<HTMLButtonElement>(
        `${panelSelector} button[aria-label^="فیلتر ${field}"]`,
      );
    }

    function shownOrderNumbers(root: HTMLElement) {
      return Array.from(root.querySelectorAll(`${panelSelector} .analysis__order-number`)).map(
        (cell) => cell.textContent?.trim(),
      );
    }

    function answerFilterDialog(selected: string[] | undefined) {
      return vi.spyOn(TestBed.inject(MatDialog), 'open').mockReturnValue({
        afterClosed: () => of({ selected }),
      } as MatDialogRef<unknown, unknown>);
    }

    it('opens the shared checkbox dialog with the statuses the list holds, in words', async () => {
      const { root } = await openProduct1();
      const open = answerFilterDialog(undefined);

      panelFilterButton(root, 'وضعیت تایید')?.dispatchEvent(new Event('click'));

      expect(open).toHaveBeenCalledWith(CheckboxFilterDialog, {
        data: {
          fieldLabel: 'وضعیت تایید',
          options: [
            { value: 'approved', label: 'تایید شده' },
            { value: 'unapproved', label: 'تایید نشده' },
          ],
          selectedValues: undefined,
        },
      });
    });

    it('offers each approver and «بدون تایید کننده» in the approver dialog', async () => {
      const { root } = await openProduct1();
      const open = answerFilterDialog(undefined);

      panelFilterButton(root, 'تایید کننده')?.dispatchEvent(new Event('click'));

      expect(open).toHaveBeenCalledWith(CheckboxFilterDialog, {
        data: {
          fieldLabel: 'تایید کننده',
          options: [
            { value: 'مصطفی', label: 'مصطفی' },
            { value: '', label: 'بدون تایید کننده' },
          ],
          selectedValues: undefined,
        },
      });
    });

    it('hides the daily BOMs the chosen status leaves out, without asking the API again', async () => {
      const { root, fixture } = await openProduct1();
      answerFilterDialog(['unapproved']);

      panelFilterButton(root, 'وضعیت تایید')?.dispatchEvent(new Event('click'));
      await fixture.whenStable();

      expect(shownOrderNumbers(root)).toEqual([dailyBom2.orderNumber]);
      expect(panelFilterButton(root, 'وضعیت تایید')?.getAttribute('aria-label')).toBe(
        'فیلتر وضعیت تایید، ۱ مقدار انتخاب شده',
      );
    });

    it('keeps only the chosen approver', async () => {
      const { root, fixture } = await openProduct1();
      answerFilterDialog(['مصطفی']);

      panelFilterButton(root, 'تایید کننده')?.dispatchEvent(new Event('click'));
      await fixture.whenStable();

      expect(shownOrderNumbers(root)).toEqual([dailyBom1.orderNumber]);
    });

    it('says when the filters leave nothing, and offers to clear them', async () => {
      const { root, fixture } = await openProduct1();
      answerFilterDialog([]);
      panelFilterButton(root, 'وضعیت تایید')?.dispatchEvent(new Event('click'));
      await fixture.whenStable();

      expect(shownOrderNumbers(root)).toEqual([]);
      expect(root.querySelector(panelSelector)?.textContent).toContain(
        'هیچ آنالیز روزانه‌ای با این فیلترها یافت نشد.',
      );

      Array.from(root.querySelectorAll<HTMLButtonElement>(`${panelSelector} button`))
        .find((button) => button.textContent?.trim() === 'پاک کردن فیلترها')
        ?.dispatchEvent(new Event('click'));
      await fixture.whenStable();

      expect(shownOrderNumbers(root)).toEqual([dailyBom1.orderNumber, dailyBom2.orderNumber]);
    });

    it('starts the next product unfiltered', async () => {
      const { root, fixture, httpMock } = await openProduct1();
      answerFilterDialog(['unapproved']);
      panelFilterButton(root, 'وضعیت تایید')?.dispatchEvent(new Event('click'));
      await fixture.whenStable();

      detailsButton(root, product2.productName)?.dispatchEvent(new Event('click'));
      tick();
      expectDailyBomsRequest(httpMock, product2.productId).flush({ items: [dailyBom1] });
      await fixture.whenStable();

      expect(
        root
          .querySelector(
            `[aria-label="آنالیز های روزانه ${product2.productName}"] button[aria-label^="فیلتر وضعیت تایید"]`,
          )
          ?.getAttribute('aria-label'),
      ).toBe('فیلتر وضعیت تایید');
    });
  });

  describe('approving and correcting from the panel', () => {
    async function openProduct1As(role: Role) {
      const page = await setUpAs(role);
      flushProducts(page.httpMock);
      await page.fixture.whenStable();
      detailsButton(page.root, product1.productName)?.dispatchEvent(new Event('click'));
      tick();
      expectDailyBomsRequest(page.httpMock, product1.productId).flush({
        items: [dailyBom1, dailyBom2],
      });
      await page.fixture.whenStable();
      return page;
    }

    function buttonsNamed(root: HTMLElement, name: string) {
      return Array.from(root.querySelectorAll<HTMLButtonElement>('button')).filter(
        (button) => (button.getAttribute('aria-label') ?? button.textContent?.trim()) === name,
      );
    }

    it.each([Role.management, Role.system_admin])(
      'offers %s «لغو تایید» on the approved card and «تایید» on the other',
      async (role) => {
        const { root } = await openProduct1As(role);

        expect(buttonsNamed(root, 'لغو تایید')).toHaveLength(1);
        expect(buttonsNamed(root, 'تایید')).toHaveLength(1);
        expect(buttonsNamed(root, 'ویرایش وزن مواد اولیه مسی جز مغزی')).toHaveLength(2);
      },
    );

    it.each([Role.qc_inspector, Role.reporter])(
      'offers %s neither approval nor edits',
      async (role) => {
        const { root } = await openProduct1As(role);

        expect(buttonsNamed(root, 'تایید')).toHaveLength(0);
        expect(buttonsNamed(root, 'لغو تایید')).toHaveLength(0);
        expect(buttonsNamed(root, 'ویرایش وزن مواد اولیه مسی جز مغزی')).toHaveLength(0);
      },
    );

    it('re-reads the list after an approval, keeping the cards on screen meanwhile', async () => {
      const { root, fixture, httpMock } = await openProduct1As(Role.management);

      buttonsNamed(root, 'تایید')[0]?.dispatchEvent(new Event('click'));
      httpMock
        .expectOne({ method: 'POST', url: '/api/boms/2/approval' })
        .flush(null, { status: 204, statusText: 'No Content' });
      // Not `whenStable`: the re-read is itself a pending task, so that would wait on the request
      // this test has yet to answer.
      tick();

      const reload = expectDailyBomsRequest(httpMock, product1.productId);
      expect(root.querySelectorAll('mat-expansion-panel.analysis')).toHaveLength(2);
      expect(
        root.querySelector('mat-progress-bar[aria-label^="در حال بارگذاری دوبارهٔ"]'),
      ).not.toBeNull();

      reload.flush({
        items: [dailyBom1, { ...dailyBom2, approvalStatus: 'approved', approvedBy: 'مصطفی' }],
      });
      await fixture.whenStable();

      expect(buttonsNamed(root, 'تایید')).toHaveLength(0);
      expect(buttonsNamed(root, 'لغو تایید')).toHaveLength(2);
    });
  });
});
