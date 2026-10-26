import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ApplicationRef } from '@angular/core';
import { TestBed } from '@angular/core/testing';
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
  reviewedBy: 'مصطفی',
  managementNote: null,
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
  approvalStatus: 'pending',
  reviewedBy: null,
  managementNote: null,
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

/** What `GET /boms/report/filter-options` answers unless a test says otherwise. */
const filterOptions = {
  brands: [],
  componentNames: [],
  standardBomMiCodes: [],
  productNames: [],
  registeredByUsers: [],
  approvalStatuses: ['approved', 'pending', 'rejected'],
  reviewers: ['مصطفی'],
};

function createPage() {
  const fixture = TestBed.createComponent(BomDashboardPage);
  TestBed.inject(ApplicationRef).tick();
  const httpMock = TestBed.inject(HttpTestingController);
  httpMock
    .expectOne({ method: 'GET', url: '/api/boms/report/filter-options' })
    .flush(filterOptions);

  return {
    fixture,
    httpMock,
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

/** What every request carries until the visitor changes «وضعیت تایید»: the pending ones only. */
const DEFAULT_FILTERS = { approvalStatuses: ['pending'] };

function flushProducts(httpMock: HttpTestingController, items = [product1, product2]): void {
  expectProductsRequest(httpMock).flush({ items });
}

/** The product list's picker for one product: its name is the button. */
function detailsButton(root: HTMLElement, productName: string): HTMLButtonElement | undefined {
  return Array.from(root.querySelectorAll<HTMLButtonElement>('button.row-pick')).find(
    (button) => button.textContent?.trim() === productName,
  );
}

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
    expect(request.request.body).toEqual(DEFAULT_FILTERS);
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

    // The default «در انتظار تایید» is a filter like any other, so the message names the filters too.
    const statuses = Array.from(root.querySelectorAll('[role="status"]')).map(
      (status) => status.textContent ?? '',
    );
    expect(
      statuses.some((text) =>
        text.includes('هیچ محصولی با این بازه زمانی و فیلترها دارای آنالیز روزانه نیست'),
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
    expect(request.request.body).toEqual(DEFAULT_FILTERS);

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
    const trackingNumberCells = Array.from(
      panel?.querySelectorAll<HTMLElement>('.analysis__tracking-number') ?? [],
    ).map((cell) => cell.textContent?.trim());
    expect(trackingNumberCells).toEqual([dailyBom1.trackingNumber, dailyBom2.trackingNumber]);
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

  it('applies a picked date range as ISO instants on the next fetch', async () => {
    const { fixture, httpMock, root } = setUp();
    flushProducts(httpMock);
    await fixture.whenStable();

    // The fields take no typing; «اکنون» is the picker the page itself can press without a calendar.
    const before = Date.now();
    for (const bound of ['آغاز بازه ثبت آنالیز', 'پایان بازه ثبت آنالیز']) {
      root.querySelector<HTMLButtonElement>(`button[aria-label="اکنون برای ${bound}"]`)?.click();
      await fixture.whenStable();
    }

    const form = root.querySelector('form');
    form?.dispatchEvent(new Event('submit', { cancelable: true }));
    tick();

    const request = expectProductsRequest(httpMock);
    const body = request.request.body as { from: string; to: string };
    const from = new Date(body.from).getTime();
    const to = new Date(body.to).getTime();
    expect(from).toBeGreaterThanOrEqual(before);
    expect(to).toBeGreaterThanOrEqual(from);
    expect(to).toBeLessThanOrEqual(Date.now());

    request.flush({ items: [product1] });
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

  describe("the dashboard's approval filters", () => {
    const groupSelector = '[role="group"][aria-label="فیلتر تایید"]';

    function filterButton(root: HTMLElement, field: string) {
      return root.querySelector<HTMLButtonElement>(
        `${groupSelector} button[aria-label^="فیلتر ${field}"]`,
      );
    }

    function answerFilterDialog(selected: string[] | undefined) {
      return vi.spyOn(TestBed.inject(MatDialog), 'open').mockReturnValue({
        afterClosed: () => of({ selected }),
      } as MatDialogRef<unknown, unknown>);
    }

    async function loaded() {
      const page = setUp();
      flushProducts(page.httpMock);
      await page.fixture.whenStable();
      return page;
    }

    async function openProduct1() {
      const page = await loaded();
      detailsButton(page.root, product1.productName)?.dispatchEvent(new Event('click'));
      tick();
      expectDailyBomsRequest(page.httpMock, product1.productId).flush({
        items: [dailyBom1, dailyBom2],
      });
      await page.fixture.whenStable();
      return page;
    }

    function shownOrderNumbers(root: HTMLElement) {
      return Array.from(root.querySelectorAll('.panel .analysis__order-number')).map((cell) =>
        cell.textContent?.trim(),
      );
    }

    it('sits outside any product as a group named «فیلتر تایید» holding both filters', async () => {
      const { root } = await loaded();

      const group = root.querySelector(groupSelector);
      expect(group).not.toBeNull();
      expect(group?.closest('.panel')).toBeNull();
      expect(
        Array.from(group?.querySelectorAll('button') ?? []).map((button) =>
          button.getAttribute('aria-label'),
        ),
      ).toEqual(['فیلتر وضعیت تایید، ۱ مقدار انتخاب شده', 'فیلتر تایید/رد کننده']);
    });

    it('stays reachable when the list holds no product at all', async () => {
      const { fixture, httpMock, root } = setUp();
      flushProducts(httpMock, []);
      await fixture.whenStable();

      expect(filterButton(root, 'وضعیت تایید')).not.toBeNull();
    });

    it('starts on «در انتظار تایید», and says so on its button', async () => {
      const { root } = await loaded();

      expect(filterButton(root, 'وضعیت تایید')?.getAttribute('aria-label')).toBe(
        'فیلتر وضعیت تایید، ۱ مقدار انتخاب شده',
      );
      expect(filterButton(root, 'تایید/رد کننده')?.getAttribute('aria-label')).toBe(
        'فیلتر تایید/رد کننده',
      );
    });

    it('opens the shared checkbox dialog with the statuses filter-options lists, in words, «در انتظار تایید» ticked', async () => {
      const { root } = await loaded();
      const open = answerFilterDialog(undefined);

      filterButton(root, 'وضعیت تایید')?.dispatchEvent(new Event('click'));

      expect(open).toHaveBeenCalledWith(CheckboxFilterDialog, {
        data: {
          fieldLabel: 'وضعیت تایید',
          options: [
            { value: 'pending', label: 'در انتظار تایید' },
            { value: 'approved', label: 'تایید' },
            { value: 'rejected', label: 'عدم تایید' },
          ],
          selectedValues: ['pending'],
        },
      });
    });

    it('starts on «در انتظار تایید» again on every visit, whatever the last visit chose', async () => {
      const first = await loaded();
      answerFilterDialog(['approved']);
      filterButton(first.root, 'وضعیت تایید')?.dispatchEvent(new Event('click'));
      tick();
      expectProductsRequest(first.httpMock).flush({ items: [product2] });
      await first.fixture.whenStable();
      first.fixture.destroy();

      const second = createPage();
      const request = expectProductsRequest(second.httpMock);
      expect(request.request.body).toEqual(DEFAULT_FILTERS);
      request.flush({ items: [product1] });
    });

    it('offers each reviewer and «بدون تایید/رد کننده» in the reviewer dialog', async () => {
      const { root } = await loaded();
      const open = answerFilterDialog(undefined);

      filterButton(root, 'تایید/رد کننده')?.dispatchEvent(new Event('click'));

      expect(open).toHaveBeenCalledWith(CheckboxFilterDialog, {
        data: {
          fieldLabel: 'تایید/رد کننده',
          options: [
            { value: 'مصطفی', label: 'مصطفی' },
            { value: '', label: 'بدون تایید/رد کننده' },
          ],
          selectedValues: undefined,
        },
      });
    });

    it('reloads the product list with the chosen statuses as soon as the dialog applies', async () => {
      const { fixture, httpMock, root } = await loaded();
      answerFilterDialog(['approved', 'pending']);

      filterButton(root, 'وضعیت تایید')?.dispatchEvent(new Event('click'));
      tick();

      const request = expectProductsRequest(httpMock);
      expect(request.request.body).toEqual({ approvalStatuses: ['approved', 'pending'] });
      request.flush({ items: [product1] });
      await fixture.whenStable();

      expect(filterButton(root, 'وضعیت تایید')?.getAttribute('aria-label')).toBe(
        'فیلتر وضعیت تایید، ۲ مقدار انتخاب شده',
      );
    });

    it("sends the same filters for the open product's daily BOMs, and lists what they return", async () => {
      const { fixture, httpMock, root } = await openProduct1();
      answerFilterDialog(['مصطفی', '']);

      filterButton(root, 'تایید/رد کننده')?.dispatchEvent(new Event('click'));
      tick();

      const expected = { ...DEFAULT_FILTERS, reviewers: ['مصطفی', ''] };
      const products = expectProductsRequest(httpMock);
      expect(products.request.body).toEqual(expected);
      const dailyBoms = expectDailyBomsRequest(httpMock, product1.productId);
      expect(dailyBoms.request.body).toEqual(expected);
      products.flush({ items: [product1, product2] });
      dailyBoms.flush({ items: [dailyBom2] });
      await fixture.whenStable();

      expect(shownOrderNumbers(root)).toEqual([dailyBom2.orderNumber]);
    });

    it('lifts the untouched default status filter when only named reviewers are chosen', async () => {
      const { httpMock, root } = await loaded();
      const open = answerFilterDialog(['مصطفی']);

      filterButton(root, 'تایید/رد کننده')?.dispatchEvent(new Event('click'));
      tick();

      // A pending daily BOM has no reviewer, so «در انتظار تایید» would leave nothing to show.
      expect(expectProductsRequest(httpMock).request.body).toEqual({ reviewers: ['مصطفی'] });
      expect(filterButton(root, 'وضعیت تایید')?.getAttribute('aria-label')).toBe(
        'فیلتر وضعیت تایید',
      );

      open.mockClear();
      // Only looked at, then cancelled — no new filter, so no new request.
      open.mockReturnValue({ afterClosed: () => of(undefined) } as MatDialogRef<unknown, unknown>);
      filterButton(root, 'وضعیت تایید')?.dispatchEvent(new Event('click'));
      expect(open).toHaveBeenCalledWith(
        CheckboxFilterDialog,
        expect.objectContaining({
          data: expect.objectContaining({ fieldLabel: 'وضعیت تایید', selectedValues: undefined }),
        }),
      );
    });

    it('leaves statuses the visitor chose alone when named reviewers are chosen', async () => {
      const { fixture, httpMock, root } = await loaded();
      const open = answerFilterDialog(['pending', 'rejected']);
      filterButton(root, 'وضعیت تایید')?.dispatchEvent(new Event('click'));
      tick();
      expectProductsRequest(httpMock).flush({ items: [product1] });
      await fixture.whenStable();

      open.mockReturnValue({
        afterClosed: () => of({ selected: ['مصطفی'] }),
      } as MatDialogRef<unknown, unknown>);
      filterButton(root, 'تایید/رد کننده')?.dispatchEvent(new Event('click'));
      tick();

      expect(expectProductsRequest(httpMock).request.body).toEqual({
        approvalStatuses: ['pending', 'rejected'],
        reviewers: ['مصطفی'],
      });
    });

    it('starts on «در انتظار تایید» again on the next visit, after a reviewer filter lifted it', async () => {
      const first = await loaded();
      answerFilterDialog(['مصطفی']);
      filterButton(first.root, 'تایید/رد کننده')?.dispatchEvent(new Event('click'));
      tick();
      expectProductsRequest(first.httpMock).flush({ items: [product1] });
      await first.fixture.whenStable();
      first.fixture.destroy();

      const second = createPage();
      const request = expectProductsRequest(second.httpMock);
      expect(request.request.body).toEqual(DEFAULT_FILTERS);
      request.flush({ items: [product1] });
    });

    it('closes the panel when the filters leave its product out, and does not bring it back', async () => {
      const { fixture, httpMock, root } = await openProduct1();
      answerFilterDialog(['approved']);

      filterButton(root, 'وضعیت تایید')?.dispatchEvent(new Event('click'));
      tick();
      expectProductsRequest(httpMock).flush({ items: [product2] });
      await fixture.whenStable();
      // The panel's re-read went out alongside; its product leaving the list cancels it.
      expect(
        httpMock
          .match({ method: 'POST', url: `/api/boms/dashboard/${product1.productId}/daily-boms` })
          .every((request) => request.cancelled),
      ).toBe(true);

      expect(root.querySelector('.panel')).toBeNull();

      answerFilterDialog(undefined);
      filterButton(root, 'وضعیت تایید')?.dispatchEvent(new Event('click'));
      tick();
      expectProductsRequest(httpMock).flush({ items: [product1, product2] });
      await fixture.whenStable();

      expect(root.querySelector('.panel')).toBeNull();
      expect(detailsButton(root, product1.productName)?.getAttribute('aria-pressed')).toBe('false');
    });

    it('says when the filters leave no product, and offers to lift them all — the default too', async () => {
      const { fixture, httpMock, root } = await loaded();
      answerFilterDialog([]);

      filterButton(root, 'وضعیت تایید')?.dispatchEvent(new Event('click'));
      tick();
      expectProductsRequest(httpMock).flush({ items: [] });
      await fixture.whenStable();

      const empty = root.querySelector('app-empty-state');
      expect(empty?.querySelector('[role="status"]')?.textContent).toContain(
        'هیچ محصولی با این بازه زمانی و فیلترها دارای آنالیز روزانه نیست',
      );

      Array.from(empty?.querySelectorAll('button') ?? [])
        .find((button) => button.textContent?.trim() === 'پاک کردن فیلترها')
        ?.dispatchEvent(new Event('click'));
      tick();

      const request = expectProductsRequest(httpMock);
      expect(request.request.body).toEqual({});
      request.flush({ items: [product1] });
      await fixture.whenStable();

      expect(filterButton(root, 'وضعیت تایید')?.getAttribute('aria-label')).toBe(
        'فیلتر وضعیت تایید',
      );
    });
  });

  describe("the dashboard's number searches", () => {
    const FIELDS = ['شماره سفارش', 'شماره ردیابی'];

    /** The text field whose `<mat-label>` reads exactly `label`. */
    function searchField(root: HTMLElement, label: string): HTMLInputElement | undefined {
      const field = Array.from(root.querySelectorAll('mat-form-field')).find(
        (each) => each.querySelector('mat-label')?.textContent?.trim() === label,
      );
      return field?.querySelector<HTMLInputElement>('input') ?? undefined;
    }

    function type(root: HTMLElement, label: string, text: string): void {
      const input = searchField(root, label);
      if (input === undefined) {
        throw new Error(`no «${label}» field`);
      }
      input.value = text;
      input.dispatchEvent(new Event('input'));
      tick();
    }

    function applyDateRange(root: HTMLElement): void {
      root.querySelector('form')?.dispatchEvent(new Event('submit', { cancelable: true }));
      tick();
    }

    async function loaded() {
      const page = setUp();
      flushProducts(page.httpMock);
      await page.fixture.whenStable();
      return page;
    }

    afterEach(() => {
      vi.useRealTimers();
    });

    it('offers a plain text field for each, labelled by the number it searches, in the filter bar', async () => {
      const { root } = await loaded();

      for (const label of FIELDS) {
        const input = searchField(root, label);
        expect(input?.type).toBe('text');
        expect(input?.closest('.filter-bar')).not.toBeNull();
        const labelled = root.querySelector(`label[for="${input?.id}"]`);
        expect(labelled?.textContent?.trim()).toBe(label);
      }
    });

    it('sends the typed text with «اعمال بازه», alongside the default status filter', async () => {
      const { httpMock, root } = await loaded();

      type(root, 'شماره سفارش', 'ORD-20');
      type(root, 'شماره ردیابی', 'TRK-6');
      applyDateRange(root);

      const request = expectProductsRequest(httpMock);
      expect(request.request.body).toEqual({
        ...DEFAULT_FILTERS,
        orderNumber: 'ORD-20',
        trackingNumber: 'TRK-6',
      });
      request.flush({ items: [product1] });
    });

    it("narrows the open product's daily BOMs by the same text", async () => {
      const { fixture, httpMock, root } = await loaded();
      detailsButton(root, product1.productName)?.dispatchEvent(new Event('click'));
      tick();
      expectDailyBomsRequest(httpMock, product1.productId).flush({
        items: [dailyBom1, dailyBom2],
      });
      await fixture.whenStable();

      type(root, 'شماره ردیابی', 'TRK-6002');
      applyDateRange(root);

      expectProductsRequest(httpMock).flush({ items: [product1] });
      const request = expectDailyBomsRequest(httpMock, product1.productId);
      expect(request.request.body).toEqual({ ...DEFAULT_FILTERS, trackingNumber: 'TRK-6002' });
      request.flush({ items: [dailyBom2] });
      await fixture.whenStable();

      expect(
        Array.from(root.querySelectorAll('.panel .analysis__order-number')).map((cell) =>
          cell.textContent?.trim(),
        ),
      ).toEqual(['ORD-5002']);
    });

    it('applies the text by itself once the visitor pauses typing', async () => {
      const { httpMock, root } = await loaded();
      vi.useFakeTimers();

      type(root, 'شماره سفارش', 'ORD');
      vi.advanceTimersByTime(100);
      tick();
      httpMock.expectNone({ method: 'POST', url: '/api/boms/dashboard' });

      type(root, 'شماره سفارش', 'ORD-20');
      vi.advanceTimersByTime(1000);
      tick();

      const request = expectProductsRequest(httpMock);
      expect(request.request.body).toEqual({ ...DEFAULT_FILTERS, orderNumber: 'ORD-20' });
      request.flush({ items: [product1] });
    });

    it('applies the text at once on Enter', async () => {
      const { httpMock, root } = await loaded();

      type(root, 'شماره سفارش', 'ORD-20');
      searchField(root, 'شماره سفارش')?.dispatchEvent(
        new KeyboardEvent('keydown', { key: 'Enter' }),
      );
      tick();

      const request = expectProductsRequest(httpMock);
      expect(request.request.body).toEqual({ ...DEFAULT_FILTERS, orderNumber: 'ORD-20' });
      request.flush({ items: [product1] });
    });

    it('asks for nothing new when «اعمال بازه» finds the same text already applied', async () => {
      const { httpMock, root } = await loaded();

      type(root, 'شماره سفارش', 'ORD-20');
      applyDateRange(root);
      expectProductsRequest(httpMock).flush({ items: [product1] });

      type(root, 'شماره سفارش', ' ORD-20 ');
      searchField(root, 'شماره سفارش')?.dispatchEvent(
        new KeyboardEvent('keydown', { key: 'Enter' }),
      );
      tick();

      httpMock.expectNone({ method: 'POST', url: '/api/boms/dashboard' });
    });

    it('offers to lift the filters when a search leaves no product, and empties both fields', async () => {
      const { fixture, httpMock, root } = await loaded();

      type(root, 'شماره سفارش', 'NOPE');
      applyDateRange(root);
      expectProductsRequest(httpMock).flush({ items: [] });
      await fixture.whenStable();

      Array.from(root.querySelectorAll('app-empty-state button'))
        .find((button) => button.textContent?.trim() === 'پاک کردن فیلترها')
        ?.dispatchEvent(new Event('click'));
      tick();

      const request = expectProductsRequest(httpMock);
      expect(request.request.body).toEqual({});
      request.flush({ items: [product1] });
      await fixture.whenStable();

      expect(searchField(root, 'شماره سفارش')?.value).toBe('');
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
      'offers %s «تایید» and «عدم تایید» on the pending card only',
      async (role) => {
        const { root } = await openProduct1As(role);

        expect(buttonsNamed(root, 'تایید')).toHaveLength(1);
        expect(buttonsNamed(root, 'عدم تایید')).toHaveLength(1);
        expect(buttonsNamed(root, 'لغو تایید')).toHaveLength(0);
        expect(buttonsNamed(root, 'ویرایش وزن مواد اولیه مسی جز مغزی')).toHaveLength(2);
      },
    );

    it.each([Role.qc_inspector, Role.reporter])(
      'offers %s neither approval nor edits',
      async (role) => {
        const { root } = await openProduct1As(role);

        expect(buttonsNamed(root, 'تایید')).toHaveLength(0);
        expect(buttonsNamed(root, 'عدم تایید')).toHaveLength(0);
        expect(buttonsNamed(root, 'ویرایش وزن مواد اولیه مسی جز مغزی')).toHaveLength(0);
      },
    );

    it("re-reads the list after a weight correction and shows the line's new difference", async () => {
      const { root, fixture, httpMock } = await openProduct1As(Role.management);
      const card = () => root.querySelectorAll<HTMLElement>('mat-expansion-panel.analysis')[1]!;
      const differenceOfCopper = () => {
        const cell = card().querySelectorAll('tbody tr')[0]!.querySelectorAll('td')[3]!;
        const copy = cell.cloneNode(true) as HTMLElement;
        copy.querySelectorAll('.visually-hidden').forEach((hidden) => hidden.remove());
        return copy.textContent?.trim();
      };
      expect(differenceOfCopper()).toBe('۱');

      card()
        .querySelector<HTMLButtonElement>('button[aria-label="ویرایش وزن مواد اولیه مسی جز مغزی"]')
        ?.dispatchEvent(new Event('click'));
      await fixture.whenStable();
      const input = card().querySelector<HTMLInputElement>(
        'input[aria-label="وزن مواد اولیه مسی جز مغزی"]',
      )!;
      input.value = '2';
      input.dispatchEvent(new Event('input'));
      card().querySelector('form')?.dispatchEvent(new Event('submit'));
      await fixture.whenStable();
      httpMock
        .expectOne({ method: 'PATCH', url: '/api/boms/2' })
        .flush(null, { status: 204, statusText: 'No Content' });
      await new Promise((resolve) => setTimeout(resolve));
      tick();

      const [copper, aluminium] = dailyBom2.lines;
      flushProducts(httpMock);
      expectDailyBomsRequest(httpMock, product1.productId).flush({
        items: [
          dailyBom1,
          {
            ...dailyBom2,
            score: 2.5,
            lines: [{ ...copper, actualWeight: 2, difference: 0 }, aluminium],
          },
        ],
      });
      await fixture.whenStable();

      expect(differenceOfCopper()).toBe('');
    });

    it('re-reads both lists after an approval, keeping the product list and cards on screen meanwhile', async () => {
      const { root, fixture, httpMock } = await openProduct1As(Role.management);

      buttonsNamed(root, 'تایید')[0]?.dispatchEvent(new Event('click'));
      httpMock
        .expectOne({ method: 'POST', url: '/api/boms/2/approval' })
        .flush(null, { status: 204, statusText: 'No Content' });
      // Not `whenStable`: the re-read is itself a pending task, so that would wait on the request
      // this test has yet to answer.
      tick();

      const products = expectProductsRequest(httpMock);
      expect(products.request.body).toEqual(DEFAULT_FILTERS);
      const reload = expectDailyBomsRequest(httpMock, product1.productId);
      expect(reload.request.body).toEqual(DEFAULT_FILTERS);
      expect(detailsButton(root, product1.productName)).toBeDefined();
      expect(root.querySelectorAll('mat-expansion-panel.analysis')).toHaveLength(2);
      expect(
        root.querySelector('mat-progress-bar[aria-label^="در حال بارگذاری دوبارهٔ"]'),
      ).not.toBeNull();

      products.flush({ items: [product1, product2] });
      reload.flush({
        items: [dailyBom1, { ...dailyBom2, approvalStatus: 'approved', reviewedBy: 'مصطفی' }],
      });
      await fixture.whenStable();

      expect(buttonsNamed(root, 'تایید')).toHaveLength(0);
      expect(buttonsNamed(root, 'عدم تایید')).toHaveLength(0);
    });

    it('drops an approved daily BOM the filter excludes, focusing the panel heading in its place', async () => {
      const { root, fixture, httpMock } = await openProduct1As(Role.management);

      buttonsNamed(root, 'تایید')[0]?.focus();
      buttonsNamed(root, 'تایید')[0]?.dispatchEvent(new Event('click'));
      httpMock
        .expectOne({ method: 'POST', url: '/api/boms/2/approval' })
        .flush(null, { status: 204, statusText: 'No Content' });
      tick();
      flushProducts(httpMock, [{ ...product1, dailyBomCount: 1 }, product2]);
      expectDailyBomsRequest(httpMock, product1.productId).flush({ items: [dailyBom1] });
      await fixture.whenStable();

      expect(root.querySelectorAll('.panel .analysis__order-number')).toHaveLength(1);
      expect(document.activeElement).toBe(root.querySelector('.panel__title'));
    });

    it('closes the panel once its product has nothing left the filter shows, focusing the product list', async () => {
      const { root, fixture, httpMock } = await openProduct1As(Role.management);

      buttonsNamed(root, 'تایید')[0]?.focus();
      buttonsNamed(root, 'تایید')[0]?.dispatchEvent(new Event('click'));
      httpMock
        .expectOne({ method: 'POST', url: '/api/boms/2/approval' })
        .flush(null, { status: 204, statusText: 'No Content' });
      tick();
      flushProducts(httpMock, [product2]);
      httpMock
        .match({ method: 'POST', url: `/api/boms/dashboard/${product1.productId}/daily-boms` })
        .filter((request) => !request.cancelled)
        .forEach((request) => request.flush({ items: [] }));
      await fixture.whenStable();

      expect(root.querySelector('.panel')).toBeNull();
      expect(detailsButton(root, product1.productName)).toBeUndefined();
      expect(document.activeElement).toBe(detailsButton(root, product2.productName));
    });
  });
});
