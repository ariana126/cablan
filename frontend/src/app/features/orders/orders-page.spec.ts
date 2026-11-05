import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ApplicationRef } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { MatDialog, MatDialogRef } from '@angular/material/dialog';
import { provideRouter } from '@angular/router';
import { of } from 'rxjs';
import { describe, expect, it, vi } from 'vitest';

import { Role } from '../../api/model';
import { signInAs } from '../../core/identity/testing/sign-in-as';
import { AddOrderMiCodeDialog } from './add-order-mi-code-dialog';
import { ConfirmDeleteOrderDialog } from './confirm-delete-order-dialog';
import { OrderFormDialog } from './order-form-dialog';
import { OrdersPage } from './orders-page';
import { order, standardBom } from './testing/orders-fixtures';

const ORDERS = {
  items: [
    order(),
    order({
      id: 'o2',
      orderNumber: 'ORD-5002',
      miCodes: [{ standardBomId: 's3', miCode: '2001', productId: 'p2', productName: 'کابل 4' }],
      dailyBomCount: 3,
    }),
  ],
};

const STANDARD_BOMS_RESPONSE = [
  { ...standardBom('s1', '1001', 'لگراند') },
  { ...standardBom('s3', '2001', 'افق') },
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

/** Answers the page's reads: the orders, and — for those who may write — the standard BOMs. */
async function load(context: Awaited<ReturnType<typeof setUp>>, writes: boolean) {
  context.httpMock.expectOne({ method: 'GET', url: '/api/orders' }).flush(ORDERS);
  if (writes) {
    context.httpMock
      .expectOne({ method: 'GET', url: '/api/standard-boms' })
      .flush(STANDARD_BOMS_RESPONSE);
  }
  await context.fixture.whenStable();
}

const text = (element: Element | null | undefined) =>
  element?.textContent?.replace(/\s+/g, ' ').trim() ?? '';

function rowOf(root: HTMLElement, orderNumber: string): HTMLElement {
  return Array.from(root.querySelectorAll<HTMLElement>('tr.mat-mdc-row')).find(
    (row) => text(row.querySelector('td.mat-column-orderNumber')) === orderNumber,
  ) as HTMLElement;
}

function buttonNamed(root: HTMLElement, name: string): HTMLButtonElement | undefined {
  return Array.from(root.querySelectorAll<HTMLButtonElement>('button')).find(
    (button) => (button.getAttribute('aria-label') ?? text(button)) === name,
  );
}

function stubDialog(result: boolean) {
  return vi.spyOn(TestBed.inject(MatDialog), 'open').mockReturnValue({
    afterClosed: () => of(result),
  } as MatDialogRef<unknown>);
}

describe('OrdersPage', () => {
  it('is headed «سفارشات»', async () => {
    const context = await setUp(Role.reporter);
    await load(context, false);

    expect(text(context.root.querySelector('h1'))).toBe('سفارشات');
  });

  it('lists each order with its number and every MI code with its product', async () => {
    const context = await setUp(Role.reporter);
    await load(context, false);

    const headers = Array.from(context.root.querySelectorAll('th')).map((th) => text(th));
    expect(headers).toEqual(['شماره سفارش', 'کدهای MI']);
    const codes = Array.from(
      rowOf(context.root, 'ORD-5001').querySelectorAll('td.mat-column-miCodes li'),
    ).map((item) => text(item));
    expect(codes).toEqual(['1001 · کابل 2.5', '1002 · کابل 2.5']);
    expect(rowOf(context.root, 'ORD-5002')).toBeDefined();
  });

  it.each([Role.qc_inspector, Role.reporter])('offers %s no way to change orders', async (role) => {
    const context = await setUp(role);
    await load(context, false);

    expect(buttonNamed(context.root, 'تعریف سفارش')).toBeUndefined();
    expect(context.root.querySelectorAll('tr.mat-mdc-row button')).toHaveLength(0);
  });

  it.each([Role.management, Role.system_admin])(
    'offers %s defining, and per row adding an MI code, editing and deleting',
    async (role) => {
      const context = await setUp(role);
      await load(context, true);

      expect(buttonNamed(context.root, 'تعریف سفارش')).toBeDefined();
      const row = rowOf(context.root, 'ORD-5001');
      expect(buttonNamed(row, 'افزودن کد MI به ORD-5001')).toBeDefined();
      expect(buttonNamed(row, 'ویرایش ORD-5001')).toBeDefined();
      expect(buttonNamed(row, 'حذف ORD-5001')).toBeDefined();
    },
  );

  it('opens the form to define an order, with the standard BOMs, and re-reads after', async () => {
    const context = await setUp(Role.management);
    await load(context, true);
    const open = stubDialog(true);

    buttonNamed(context.root, 'تعریف سفارش')?.click();
    TestBed.inject(ApplicationRef).tick();

    expect(open).toHaveBeenCalledWith(OrderFormDialog, {
      data: { mode: 'create', standardBoms: expect.any(Array) },
    });
    context.httpMock.expectOne({ method: 'GET', url: '/api/orders' }).flush(ORDERS);
  });

  it('opens the edit form with the row’s order', async () => {
    const context = await setUp(Role.management);
    await load(context, true);
    const open = stubDialog(false);

    buttonNamed(rowOf(context.root, 'ORD-5001'), 'ویرایش ORD-5001')?.click();

    expect(open).toHaveBeenCalledWith(OrderFormDialog, {
      data: { mode: 'edit', order: ORDERS.items[0], standardBoms: expect.any(Array) },
    });
  });

  it('opens «افزودن کد MI» with the row’s order', async () => {
    const context = await setUp(Role.management);
    await load(context, true);
    const open = stubDialog(false);

    buttonNamed(rowOf(context.root, 'ORD-5001'), 'افزودن کد MI به ORD-5001')?.click();

    expect(open).toHaveBeenCalledWith(AddOrderMiCodeDialog, {
      data: { order: ORDERS.items[0], standardBoms: expect.any(Array) },
    });
  });

  it('asks Management to confirm a plain delete, even of an order in use', async () => {
    const context = await setUp(Role.management);
    await load(context, true);
    const open = stubDialog(false);

    buttonNamed(rowOf(context.root, 'ORD-5002'), 'حذف ORD-5002')?.click();

    expect(open).toHaveBeenCalledWith(
      ConfirmDeleteOrderDialog,
      expect.objectContaining({ data: { order: ORDERS.items[1], deletesDailyBoms: false } }),
    );
  });

  it('warns the System Admin that an order in use takes its daily BOMs with it', async () => {
    const context = await setUp(Role.system_admin);
    await load(context, true);
    const open = stubDialog(false);

    buttonNamed(rowOf(context.root, 'ORD-5002'), 'حذف ORD-5002')?.click();
    buttonNamed(rowOf(context.root, 'ORD-5001'), 'حذف ORD-5001')?.click();

    expect(open).toHaveBeenNthCalledWith(
      1,
      ConfirmDeleteOrderDialog,
      expect.objectContaining({ data: { order: ORDERS.items[1], deletesDailyBoms: true } }),
    );
    expect(open).toHaveBeenNthCalledWith(
      2,
      ConfirmDeleteOrderDialog,
      expect.objectContaining({ data: { order: ORDERS.items[0], deletesDailyBoms: false } }),
    );
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
