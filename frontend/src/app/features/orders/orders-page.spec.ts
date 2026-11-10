import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ApplicationRef } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { MatDialog, MatDialogRef } from '@angular/material/dialog';
import { provideRouter } from '@angular/router';
import { Subject } from 'rxjs';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { Role } from '../../api/model';
import { signInAs } from '../../core/identity/testing/sign-in-as';
import { AddOrderMiCodeDialog } from './add-order-mi-code-dialog';
import { ConfirmDeleteOrderDialog } from './confirm-delete-order-dialog';
import { OrderDetailsDialog } from './order-details-dialog';
import { OrderFormDialog } from './order-form-dialog';
import { OrdersPage } from './orders-page';
import { fieldLabelled } from './testing/autocomplete';
import { order, standardBom } from './testing/orders-fixtures';

const FIRST = order();
const SECOND = order({
  id: 'o2',
  orderNumber: 'ORD-5002',
  miCodes: [
    { standardBomId: 's3', miCode: '2001', productId: 'p2', productName: 'کابل 4' },
    { standardBomId: 's1', miCode: '1001', productId: 'p1', productName: 'کابل 2.5' },
  ],
  dailyBomCount: 3,
});
const ORDERS = { items: [FIRST, SECOND] };

const STANDARD_BOMS_RESPONSE = [
  standardBom('s1', '1001', 'لگراند'),
  { ...standardBom('s3', '2001', 'افق'), productId: 'p2' },
];
const PRODUCTS_RESPONSE = [
  { id: 'p1', name: 'کابل 2.5', components: [] },
  { id: 'p2', name: 'کابل 4', components: [] },
];

const HINT = 'برای مشاهده جزئیات هر سفارش روی ردیف آن کلیک کنید.';
const RESET = 'پاک کردن جست‌وجو';

async function setUp(role: Role) {
  localStorage.clear();
  TestBed.configureTestingModule({
    providers: [provideHttpClient(), provideHttpClientTesting(), provideRouter([])],
  });
  const httpMock = TestBed.inject(HttpTestingController);
  await signInAs(role, httpMock);

  const fixture = TestBed.createComponent(OrdersPage);
  document.body.appendChild(fixture.nativeElement);
  TestBed.inject(ApplicationRef).tick();
  return { fixture, httpMock, root: fixture.nativeElement as HTMLElement };
}

type Context = Awaited<ReturnType<typeof setUp>>;

/** Answers the page's reads: the orders, and — for those who may write — what the dialogs offer. */
async function load(context: Context, writes: boolean) {
  context.httpMock.expectOne({ method: 'GET', url: '/api/orders' }).flush(ORDERS);
  if (writes) {
    context.httpMock
      .expectOne({ method: 'GET', url: '/api/standard-boms' })
      .flush(STANDARD_BOMS_RESPONSE);
    context.httpMock.expectOne({ method: 'GET', url: '/api/products' }).flush(PRODUCTS_RESPONSE);
  }
  await context.fixture.whenStable();
}

async function loaded(role: Role, writes: boolean): Promise<Context> {
  const context = await setUp(role);
  await load(context, writes);
  return context;
}

const text = (element: Element | null | undefined) =>
  element?.textContent?.replace(/\s+/g, ' ').trim() ?? '';

const rows = (root: HTMLElement) =>
  Array.from(root.querySelectorAll<HTMLElement>('tr.mat-mdc-row'));

const shownOrders = (root: HTMLElement) =>
  rows(root).map((row) => text(row.querySelector('td.mat-column-orderNumber')));

function rowOf(root: HTMLElement, orderNumber: string): HTMLElement {
  return rows(root).find(
    (row) => text(row.querySelector('td.mat-column-orderNumber')) === orderNumber,
  ) as HTMLElement;
}

function buttonNamed(root: ParentNode, name: string): HTMLButtonElement | undefined {
  return Array.from(root.querySelectorAll<HTMLButtonElement>('button')).find(
    (button) => (button.getAttribute('aria-label') ?? text(button)) === name,
  );
}

const dialogs = () => Array.from(document.body.querySelectorAll<HTMLElement>('[role="dialog"]'));
const detailsDialog = () =>
  dialogs().find((dialog) => dialog.querySelector('app-order-details-dialog'));
const detailsHeading = () => text(detailsDialog()?.querySelector('h2'));

/** Opens an order's details through its row's button and waits for the dialog. */
async function open(context: Context, orderNumber: string) {
  buttonNamed(context.root, `جزئیات سفارش ${orderNumber}`)?.click();
  await vi.waitFor(async () => {
    await context.fixture.whenStable();
    expect(detailsHeading()).toBe(`جزئیات سفارش ${orderNumber}`);
  });
}

/** Waits until no dialog is open any more (after the exit animation). */
async function allClosed(context: Context) {
  await vi.waitFor(async () => {
    await context.fixture.whenStable();
    expect(dialogs()).toHaveLength(0);
  });
}

async function search(context: Context, query: string) {
  const input = fieldLabelled(context.root, 'جست‌وجوی سفارش').querySelector('input')!;
  input.value = query;
  input.dispatchEvent(new Event('input'));
  await context.fixture.whenStable();
}

/**
 * Lets the details dialog open for real and stubs every other one: each stubbed open answers what
 * the test sends through the returned subject, so a test decides when an action's dialog closes.
 */
function stubActionDialogs() {
  const dialog = TestBed.inject(MatDialog);
  const original = dialog.open.bind(dialog);
  const results = new Subject<boolean | undefined>();
  const spy = vi.spyOn(dialog, 'open').mockImplementation(((component: unknown, config: unknown) =>
    component === OrderDetailsDialog
      ? original(component as typeof OrderDetailsDialog, config as never)
      : ({
          afterClosed: () => results.asObservable(),
        } as unknown as MatDialogRef<unknown>)) as never);
  const actionCalls = () =>
    spy.mock.calls.filter(([component]) => component !== OrderDetailsDialog);
  return {
    spy,
    actionCalls,
    answer: (result: boolean | undefined) => {
      results.next(result);
    },
  };
}

describe('OrdersPage', () => {
  afterEach(() => {
    document.body.querySelectorAll('.cdk-overlay-container').forEach((node) => node.remove());
    document.body.querySelectorAll('app-orders-page').forEach((node) => node.remove());
    vi.restoreAllMocks();
  });

  it('is headed «سفارشات»', async () => {
    const { root } = await loaded(Role.reporter, false);

    expect(text(root.querySelector('h1'))).toBe('سفارشات');
  });

  describe('the list', () => {
    it('has the columns «شماره سفارش», «محصول» and «تعداد کد MI» — no daily-BOM count', async () => {
      const { root } = await loaded(Role.reporter, false);

      const headers = Array.from(root.querySelectorAll('th')).map((th) => text(th));
      expect(headers).toEqual(['شماره سفارش', 'محصول', 'تعداد کد MI']);
    });

    it('shows each order number alone in its cell, as a button naming its details, no icon', async () => {
      const { root } = await loaded(Role.reporter, false);

      expect(shownOrders(root)).toEqual(['ORD-5001', 'ORD-5002']);
      const button = rowOf(root, 'ORD-5002').querySelector('td.mat-column-orderNumber button');
      expect(button?.getAttribute('aria-label')).toBe('جزئیات سفارش ORD-5002');
      expect(button?.querySelector('mat-icon')).toBeNull();
    });

    it('says how to see an order’s details, near the table', async () => {
      const { root } = await loaded(Role.reporter, false);

      expect(text(root)).toContain(HINT);
    });

    it('names every product of an order once, and counts its codes', async () => {
      const { root } = await loaded(Role.reporter, false);

      const products = (row: HTMLElement) =>
        Array.from(row.querySelectorAll('td.mat-column-products li')).map(text);
      const second = rowOf(root, 'ORD-5002');
      expect(products(second)).toEqual(['کابل 4', 'کابل 2.5']);
      expect(text(second.querySelector('td.mat-column-miCodeCount'))).toBe('۲');
      expect(products(rowOf(root, 'ORD-5001'))).toEqual(['کابل 2.5']);
    });

    it('has no action buttons in its rows, whatever the role', async () => {
      const { root } = await loaded(Role.system_admin, true);

      for (const row of rows(root)) {
        expect(row.querySelectorAll('button')).toHaveLength(1);
      }
    });

    it('says so when no order is defined yet', async () => {
      const context = await setUp(Role.reporter);
      context.httpMock.expectOne({ method: 'GET', url: '/api/orders' }).flush({ items: [] });
      await context.fixture.whenStable();

      expect(text(context.root)).toContain('هیچ سفارشی تعریف نشده است.');
      expect(text(context.root)).not.toContain(HINT);
    });

    it('offers a retry when the list fails to load', async () => {
      const context = await setUp(Role.reporter);
      context.httpMock
        .expectOne({ method: 'GET', url: '/api/orders' })
        .flush(null, { status: 500, statusText: 'Server Error' });
      await context.fixture.whenStable();

      expect(text(context.root.querySelector('[role="alert"]'))).toContain(
        'فهرست سفارشات بارگذاری نشد.',
      );
    });
  });

  describe('the search', () => {
    it('searches as you type, in one search box «جست‌وجوی سفارش» and no other filter', async () => {
      const context = await loaded(Role.reporter, false);
      const input = fieldLabelled(context.root, 'جست‌وجوی سفارش').querySelector('input');
      expect(input?.getAttribute('type')).toBe('search');
      expect(context.root.querySelector('mat-select')).toBeNull();

      await search(context, '۵۰۰۲');

      expect(shownOrders(context.root)).toEqual(['ORD-5002']);
    });

    it('finds an order by any of its products', async () => {
      const context = await loaded(Role.reporter, false);

      await search(context, 'کابل 4');
      expect(shownOrders(context.root)).toEqual(['ORD-5002']);

      await search(context, 'کابل 2.5');
      expect(shownOrders(context.root)).toEqual(['ORD-5001', 'ORD-5002']);
    });

    it('shows every order again once the search is cleared', async () => {
      const context = await loaded(Role.reporter, false);
      await search(context, '5002');

      await search(context, '');

      expect(shownOrders(context.root)).toEqual(['ORD-5001', 'ORD-5002']);
    });

    it('says when nothing matches, offering to clear the search', async () => {
      const context = await loaded(Role.reporter, false);

      await search(context, 'هیچ');

      expect(rows(context.root)).toHaveLength(0);
      expect(text(context.root)).toContain('هیچ سفارشی با این جست‌وجو پیدا نشد.');
      buttonNamed(context.root, RESET)?.click();
      await context.fixture.whenStable();
      expect(shownOrders(context.root)).toEqual(['ORD-5001', 'ORD-5002']);
      expect(fieldLabelled(context.root, 'جست‌وجوی سفارش').querySelector('input')?.value).toBe('');
    });
  });

  describe('the details dialog', () => {
    it('opens on the order chosen, with its codes and products', async () => {
      const context = await loaded(Role.reporter, false);
      expect(dialogs()).toHaveLength(0);

      await open(context, 'ORD-5002');

      expect(dialogs()).toHaveLength(1);
      expect(text(detailsDialog())).toContain('2001');
      expect(text(detailsDialog())).toContain('کابل 4');
    });

    it('opens from a click anywhere on the row, through the order-number button', async () => {
      const { root } = await loaded(Role.reporter, false);

      // The button's hit area covers its row (CSS); the row itself has no click handler.
      const row = rowOf(root, 'ORD-5001');
      expect(row.getAttribute('tabindex')).toBeNull();
      expect(row.querySelector('td.mat-column-orderNumber button.order-select')).not.toBeNull();
    });

    it('closes with its «بستن», keeping the search and its results', async () => {
      const context = await loaded(Role.reporter, false);
      await search(context, '5002');
      await open(context, 'ORD-5002');

      buttonNamed(detailsDialog()!, 'بستن')?.click();
      await allClosed(context);

      expect(fieldLabelled(context.root, 'جست‌وجوی سفارش').querySelector('input')?.value).toBe(
        '5002',
      );
      expect(shownOrders(context.root)).toEqual(['ORD-5002']);
    });

    it('shows only the order opened next', async () => {
      const context = await loaded(Role.reporter, false);
      await open(context, 'ORD-5002');
      buttonNamed(detailsDialog()!, 'بستن')?.click();
      await allClosed(context);

      await open(context, 'ORD-5001');

      expect(dialogs()).toHaveLength(1);
      expect(text(detailsDialog())).not.toContain('2001');
    });

    it('closes on a click outside it', async () => {
      const context = await loaded(Role.reporter, false);
      await open(context, 'ORD-5001');

      document.body.querySelector<HTMLElement>('.cdk-overlay-backdrop')?.click();
      await allClosed(context);
    });

    it.each([Role.qc_inspector, Role.reporter])(
      'offers %s no way to change orders',
      async (role) => {
        const context = await loaded(role, false);
        await open(context, 'ORD-5001');

        expect(buttonNamed(context.root, 'تعریف سفارش')).toBeUndefined();
        for (const name of ['افزودن کد MI', 'ویرایش', 'حذف']) {
          expect(buttonNamed(detailsDialog()!, name)).toBeUndefined();
        }
      },
    );

    it.each([Role.management, Role.system_admin])(
      'offers %s defining, and in the dialog adding a code, editing and deleting',
      async (role) => {
        const context = await loaded(role, true);
        await open(context, 'ORD-5001');

        expect(buttonNamed(context.root, 'تعریف سفارش')).toBeDefined();
        for (const name of ['افزودن کد MI', 'ویرایش', 'حذف']) {
          expect(buttonNamed(detailsDialog()!, name)).toBeDefined();
        }
      },
    );

    it('tells Management before they try that an order in use can’t be edited', async () => {
      const context = await loaded(Role.management, true);
      await open(context, 'ORD-5002');

      expect(buttonNamed(detailsDialog()!, 'ویرایش')?.getAttribute('aria-disabled')).toBe('true');
      expect(text(detailsDialog())).toContain('این سفارش در ۳ آنالیز روزانه ثبت شده است');
    });
  });

  describe('changing an order', () => {
    it('opens the form to define an order, with the MI codes and their products', async () => {
      const context = await loaded(Role.management, true);
      const { spy, answer } = stubActionDialogs();

      buttonNamed(context.root, 'تعریف سفارش')?.click();
      answer(true);
      TestBed.inject(ApplicationRef).tick();

      expect(spy).toHaveBeenCalledWith(OrderFormDialog, {
        data: {
          mode: 'create',
          miCodeOptions: [
            { miCode: '1001', productName: 'کابل 2.5' },
            { miCode: '2001', productName: 'کابل 4' },
          ],
        },
      });
      context.httpMock.expectOne({ method: 'GET', url: '/api/orders' }).flush(ORDERS);
    });

    it('opens the edit form in place of the details, with that order', async () => {
      const context = await loaded(Role.management, true);
      const { actionCalls } = stubActionDialogs();
      await open(context, 'ORD-5001');

      buttonNamed(detailsDialog()!, 'ویرایش')?.click();
      await allClosed(context);

      expect(actionCalls()).toEqual([
        [
          OrderFormDialog,
          { data: { mode: 'edit', order: FIRST, miCodeOptions: expect.any(Array) } },
        ],
      ]);
    });

    it('opens «افزودن کد MI» with that order', async () => {
      const context = await loaded(Role.management, true);
      const { actionCalls } = stubActionDialogs();
      await open(context, 'ORD-5002');

      buttonNamed(detailsDialog()!, 'افزودن کد MI')?.click();
      await allClosed(context);

      expect(actionCalls()).toEqual([
        [AddOrderMiCodeDialog, { data: { order: SECOND, miCodeOptions: expect.any(Array) } }],
      ]);
    });

    it('re-reads after a change and shows the details again, as the order now is', async () => {
      const context = await loaded(Role.management, true);
      const { answer } = stubActionDialogs();
      await open(context, 'ORD-5001');
      buttonNamed(detailsDialog()!, 'ویرایش')?.click();
      await allClosed(context);

      answer(true);
      TestBed.inject(ApplicationRef).tick();
      context.httpMock
        .expectOne({ method: 'GET', url: '/api/orders' })
        .flush({ items: [{ ...FIRST, orderNumber: 'ORD-7001' }, SECOND] });

      await vi.waitFor(async () => {
        await context.fixture.whenStable();
        expect(detailsHeading()).toBe('جزئیات سفارش ORD-7001');
      });
    });

    it('goes back to the details when the action is cancelled, re-reading nothing', async () => {
      const context = await loaded(Role.management, true);
      const { answer } = stubActionDialogs();
      await open(context, 'ORD-5002');
      buttonNamed(detailsDialog()!, 'افزودن کد MI')?.click();
      await allClosed(context);

      answer(undefined);

      await vi.waitFor(async () => {
        await context.fixture.whenStable();
        expect(detailsHeading()).toBe('جزئیات سفارش ORD-5002');
      });
      context.httpMock.expectNone({ method: 'GET', url: '/api/orders' });
    });

    it('warns the System Admin that an order in use takes its daily BOMs with it', async () => {
      const context = await loaded(Role.system_admin, true);
      const { actionCalls } = stubActionDialogs();

      await open(context, 'ORD-5002');
      buttonNamed(detailsDialog()!, 'حذف')?.click();
      await allClosed(context);

      expect(actionCalls()).toEqual([
        [
          ConfirmDeleteOrderDialog,
          expect.objectContaining({ data: { order: SECOND, deletesDailyBoms: true } }),
        ],
      ]);
    });

    it('does not warn of daily BOMs for an order without any', async () => {
      const context = await loaded(Role.system_admin, true);
      const { actionCalls } = stubActionDialogs();

      await open(context, 'ORD-5001');
      buttonNamed(detailsDialog()!, 'حذف')?.click();
      await allClosed(context);

      expect(actionCalls()).toEqual([
        [
          ConfirmDeleteOrderDialog,
          expect.objectContaining({ data: { order: FIRST, deletesDailyBoms: false } }),
        ],
      ]);
    });

    it('leaves the details closed once the order is deleted, focus on «تعریف سفارش»', async () => {
      const context = await loaded(Role.management, true);
      const { answer } = stubActionDialogs();
      await open(context, 'ORD-5001');
      buttonNamed(detailsDialog()!, 'حذف')?.click();
      await allClosed(context);

      answer(true);
      TestBed.inject(ApplicationRef).tick();
      context.httpMock.expectOne({ method: 'GET', url: '/api/orders' }).flush({ items: [SECOND] });
      await context.fixture.whenStable();

      expect(dialogs()).toHaveLength(0);
      expect(shownOrders(context.root)).toEqual(['ORD-5002']);
      expect(document.activeElement).toBe(buttonNamed(context.root, 'تعریف سفارش'));
    });
  });
});
