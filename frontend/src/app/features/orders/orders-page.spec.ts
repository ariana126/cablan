import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ApplicationRef } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { MatDialog, MatDialogRef } from '@angular/material/dialog';
import { provideRouter } from '@angular/router';
import { of } from 'rxjs';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { Role } from '../../api/model';
import { signInAs } from '../../core/identity/testing/sign-in-as';
import { AddOrderMiCodeDialog } from './add-order-mi-code-dialog';
import { ConfirmDeleteOrderDialog } from './confirm-delete-order-dialog';
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

async function setUp(role: Role) {
  localStorage.clear();
  TestBed.configureTestingModule({
    providers: [provideHttpClient(), provideHttpClientTesting(), provideRouter([])],
  });
  const httpMock = TestBed.inject(HttpTestingController);
  await signInAs(role, httpMock);

  const fixture = TestBed.createComponent(OrdersPage);
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

function buttonNamed(root: HTMLElement, name: string): HTMLButtonElement | undefined {
  return Array.from(root.querySelectorAll<HTMLButtonElement>('button')).find(
    (button) => (button.getAttribute('aria-label') ?? text(button)) === name,
  );
}

const panel = (root: HTMLElement) => root.querySelector<HTMLElement>('section.order-details');

async function select(context: Context, orderNumber: string) {
  buttonNamed(context.root, `جزئیات سفارش ${orderNumber}`)?.click();
  await context.fixture.whenStable();
}

async function search(context: Context, query: string) {
  const input = fieldLabelled(context.root, 'جست‌وجوی سفارش').querySelector('input')!;
  input.value = query;
  input.dispatchEvent(new Event('input'));
  await context.fixture.whenStable();
}

async function chooseFilter(context: Context, label: string, option: string) {
  fieldLabelled(context.root, label).querySelector<HTMLElement>('.mat-mdc-select-trigger')?.click();
  await context.fixture.whenStable();
  Array.from(document.body.querySelectorAll<HTMLElement>('mat-option'))
    .find((candidate) => text(candidate) === option)
    ?.click();
  await context.fixture.whenStable();
}

function stubDialog(result: boolean) {
  return vi.spyOn(TestBed.inject(MatDialog), 'open').mockReturnValue({
    afterClosed: () => of(result),
  } as MatDialogRef<unknown>);
}

const RESET = 'پاک کردن جست‌وجو و فیلترها';

describe('OrdersPage', () => {
  afterEach(() => {
    document.body.querySelectorAll('.cdk-overlay-container').forEach((node) => node.remove());
  });

  it('is headed «سفارشات»', async () => {
    const { root } = await loaded(Role.reporter, false);

    expect(text(root.querySelector('h1'))).toBe('سفارشات');
  });

  describe('the list', () => {
    it('has the columns «شماره سفارش», «محصول», «تعداد کد MI» and «آنالیز روزانه»', async () => {
      const { root } = await loaded(Role.reporter, false);

      const headers = Array.from(root.querySelectorAll('th')).map((th) => text(th));
      expect(headers).toEqual(['شماره سفارش', 'محصول', 'تعداد کد MI', 'آنالیز روزانه']);
    });

    it('shows each order number alone in its cell, as a button naming its details', async () => {
      const { root } = await loaded(Role.reporter, false);

      expect(shownOrders(root)).toEqual(['ORD-5001', 'ORD-5002']);
      const button = rowOf(root, 'ORD-5002').querySelector('td.mat-column-orderNumber button');
      expect(button?.getAttribute('aria-label')).toBe('جزئیات سفارش ORD-5002');
    });

    it('names every product of an order once, and counts its codes and daily BOMs', async () => {
      const { root } = await loaded(Role.reporter, false);

      const products = (row: HTMLElement) =>
        Array.from(row.querySelectorAll('td.mat-column-products li')).map(text);
      const second = rowOf(root, 'ORD-5002');
      expect(products(second)).toEqual(['کابل 4', 'کابل 2.5']);
      expect(text(second.querySelector('td.mat-column-miCodeCount'))).toBe('۲');
      expect(text(second.querySelector('td.mat-column-dailyBomCount'))).toBe('۳');
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

  describe('search and filters', () => {
    it('searches as you type, in a search box «جست‌وجوی سفارش»', async () => {
      const context = await loaded(Role.reporter, false);
      const input = fieldLabelled(context.root, 'جست‌وجوی سفارش').querySelector('input');
      expect(input?.getAttribute('type')).toBe('search');

      await search(context, '۵۰۰۲');

      expect(shownOrders(context.root)).toEqual(['ORD-5002']);
    });

    it('finds orders by MI code or product name', async () => {
      const context = await loaded(Role.reporter, false);

      await search(context, '2001');
      expect(shownOrders(context.root)).toEqual(['ORD-5002']);

      await search(context, 'کابل 2.5');
      expect(shownOrders(context.root)).toEqual(['ORD-5001', 'ORD-5002']);
    });

    it('filters by product, offering every product of the list', async () => {
      const context = await loaded(Role.reporter, false);

      fieldLabelled(context.root, 'محصول')
        .querySelector<HTMLElement>('.mat-mdc-select-trigger')
        ?.click();
      await context.fixture.whenStable();
      expect(Array.from(document.body.querySelectorAll('mat-option')).map(text)).toEqual([
        'همه محصولات',
        'کابل 2.5',
        'کابل 4',
      ]);
      Array.from(document.body.querySelectorAll<HTMLElement>('mat-option'))
        .find((option) => text(option) === 'کابل 4')
        ?.click();
      await context.fixture.whenStable();

      expect(shownOrders(context.root)).toEqual(['ORD-5002']);
    });

    it('filters by whether an order has daily BOMs', async () => {
      const context = await loaded(Role.reporter, false);

      await chooseFilter(context, 'آنالیز روزانه', 'بدون آنالیز روزانه');
      expect(shownOrders(context.root)).toEqual(['ORD-5001']);

      await chooseFilter(context, 'آنالیز روزانه', 'دارای آنالیز روزانه');
      expect(shownOrders(context.root)).toEqual(['ORD-5002']);

      await chooseFilter(context, 'آنالیز روزانه', 'همه');
      expect(shownOrders(context.root)).toEqual(['ORD-5001', 'ORD-5002']);
    });

    it('combines the search and the filters, and resets all three at once', async () => {
      const context = await loaded(Role.reporter, false);
      expect(buttonNamed(context.root, RESET)).toBeUndefined();

      await search(context, 'ORD');
      await chooseFilter(context, 'محصول', 'کابل 2.5');
      await chooseFilter(context, 'آنالیز روزانه', 'دارای آنالیز روزانه');
      expect(shownOrders(context.root)).toEqual(['ORD-5002']);

      buttonNamed(context.root, RESET)?.click();
      await context.fixture.whenStable();

      expect(shownOrders(context.root)).toEqual(['ORD-5001', 'ORD-5002']);
      expect(fieldLabelled(context.root, 'جست‌وجوی سفارش').querySelector('input')?.value).toBe('');
      expect(text(fieldLabelled(context.root, 'محصول').querySelector('mat-select'))).toBe(
        'همه محصولات',
      );
    });

    it('says when nothing matches, with the reset there and only there', async () => {
      const context = await loaded(Role.reporter, false);

      await search(context, 'هیچ');

      expect(rows(context.root)).toHaveLength(0);
      expect(text(context.root)).toContain('هیچ سفارشی با این جست‌وجو و فیلترها پیدا نشد.');
      const resets = Array.from(context.root.querySelectorAll('button')).filter(
        (button) => text(button) === RESET,
      );
      expect(resets).toHaveLength(1);
      resets[0].click();
      await context.fixture.whenStable();
      expect(shownOrders(context.root)).toEqual(['ORD-5001', 'ORD-5002']);
    });
  });

  describe('the details panel', () => {
    it('opens on the order chosen, marks its row, and takes focus to its heading', async () => {
      const context = await loaded(Role.reporter, false);
      expect(panel(context.root)).toBeNull();

      await select(context, 'ORD-5002');

      expect(text(panel(context.root)?.querySelector('h2'))).toBe('جزئیات سفارش ORD-5002');
      expect(document.activeElement).toBe(panel(context.root)?.querySelector('h2'));
      const button = buttonNamed(context.root, 'جزئیات سفارش ORD-5002');
      expect(button?.getAttribute('aria-current')).toBe('true');
      expect(buttonNamed(context.root, 'جزئیات سفارش ORD-5001')?.hasAttribute('aria-current')).toBe(
        false,
      );
    });

    it('closes with «بستن جزئیات», focus back on the order', async () => {
      const context = await loaded(Role.reporter, false);
      await select(context, 'ORD-5001');

      buttonNamed(context.root, 'بستن جزئیات')?.click();
      await context.fixture.whenStable();

      expect(panel(context.root)).toBeNull();
      expect(document.activeElement).toBe(buttonNamed(context.root, 'جزئیات سفارش ORD-5001'));
    });

    it.each([Role.qc_inspector, Role.reporter])(
      'offers %s no way to change orders',
      async (role) => {
        const context = await loaded(role, false);
        await select(context, 'ORD-5001');

        for (const name of ['تعریف سفارش', 'افزودن کد MI', 'ویرایش', 'حذف']) {
          expect(buttonNamed(context.root, name)).toBeUndefined();
        }
      },
    );

    it.each([Role.management, Role.system_admin])(
      'offers %s defining, and in the panel adding a code, editing and deleting',
      async (role) => {
        const context = await loaded(role, true);
        await select(context, 'ORD-5001');

        for (const name of ['تعریف سفارش', 'افزودن کد MI', 'ویرایش', 'حذف']) {
          expect(buttonNamed(context.root, name)).toBeDefined();
        }
      },
    );

    it('tells Management before they try that an order in use can’t be edited', async () => {
      const context = await loaded(Role.management, true);
      await select(context, 'ORD-5002');

      expect(buttonNamed(context.root, 'ویرایش')?.getAttribute('aria-disabled')).toBe('true');
      expect(text(panel(context.root))).toContain('این سفارش در ۳ آنالیز روزانه ثبت شده است');
    });
  });

  describe('changing an order', () => {
    it('opens the form to define an order, with the MI codes and their products', async () => {
      const context = await loaded(Role.management, true);
      const open = stubDialog(true);

      buttonNamed(context.root, 'تعریف سفارش')?.click();
      TestBed.inject(ApplicationRef).tick();

      expect(open).toHaveBeenCalledWith(OrderFormDialog, {
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

    it('opens the edit form with the selected order', async () => {
      const context = await loaded(Role.management, true);
      await select(context, 'ORD-5001');
      const open = stubDialog(false);

      buttonNamed(context.root, 'ویرایش')?.click();

      expect(open).toHaveBeenCalledWith(OrderFormDialog, {
        data: { mode: 'edit', order: FIRST, miCodeOptions: expect.any(Array) },
      });
    });

    it('opens «افزودن کد MI» with the selected order', async () => {
      const context = await loaded(Role.management, true);
      await select(context, 'ORD-5002');
      const open = stubDialog(false);

      buttonNamed(context.root, 'افزودن کد MI')?.click();

      expect(open).toHaveBeenCalledWith(AddOrderMiCodeDialog, {
        data: { order: SECOND, miCodeOptions: expect.any(Array) },
      });
    });

    it('re-reads after a change and keeps showing the order, renumbered', async () => {
      const context = await loaded(Role.management, true);
      await select(context, 'ORD-5001');
      stubDialog(true);

      buttonNamed(context.root, 'ویرایش')?.click();
      TestBed.inject(ApplicationRef).tick();
      context.httpMock
        .expectOne({ method: 'GET', url: '/api/orders' })
        .flush({ items: [{ ...FIRST, orderNumber: 'ORD-7001' }, SECOND] });
      await context.fixture.whenStable();

      expect(text(panel(context.root)?.querySelector('h2'))).toBe('جزئیات سفارش ORD-7001');
    });

    it('warns the System Admin that an order in use takes its daily BOMs with it', async () => {
      const context = await loaded(Role.system_admin, true);
      const open = stubDialog(false);

      await select(context, 'ORD-5002');
      buttonNamed(context.root, 'حذف')?.click();
      await select(context, 'ORD-5001');
      buttonNamed(context.root, 'حذف')?.click();

      expect(open).toHaveBeenNthCalledWith(
        1,
        ConfirmDeleteOrderDialog,
        expect.objectContaining({ data: { order: SECOND, deletesDailyBoms: true } }),
      );
      expect(open).toHaveBeenNthCalledWith(
        2,
        ConfirmDeleteOrderDialog,
        expect.objectContaining({ data: { order: FIRST, deletesDailyBoms: false } }),
      );
    });

    it('closes the panel once its order is deleted, focus on «تعریف سفارش»', async () => {
      const context = await loaded(Role.management, true);
      await select(context, 'ORD-5001');
      stubDialog(true);

      buttonNamed(context.root, 'حذف')?.click();
      TestBed.inject(ApplicationRef).tick();
      context.httpMock.expectOne({ method: 'GET', url: '/api/orders' }).flush({ items: [SECOND] });
      await context.fixture.whenStable();

      expect(panel(context.root)).toBeNull();
      expect(document.activeElement).toBe(buttonNamed(context.root, 'تعریف سفارش'));
    });
  });
});
