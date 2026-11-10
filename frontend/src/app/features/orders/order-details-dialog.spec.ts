import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { describe, expect, it, vi } from 'vitest';

import { AppOrder } from '../../core/orders/orders-gateway';
import { OrderDetailsDialog, OrderDetailsDialogData } from './order-details-dialog';
import { order } from './testing/orders-fixtures';

const MIXED = order({
  miCodes: [
    { standardBomId: 's1', miCode: '1001', productId: 'p1', productName: 'کابل 2.5' },
    {
      standardBomId: 's3',
      miCode: '2001',
      productId: 'p2',
      productName: 'کابل مسی افشان دو رشته با روکش PVC و عایق XLPE',
    },
  ],
  dailyBomCount: 3,
});

interface Setup {
  readonly order?: AppOrder;
  readonly canManage?: boolean;
  readonly canCorrectRecordsInUse?: boolean;
}

async function render({
  order: shown = order(),
  canManage = false,
  canCorrectRecordsInUse = false,
}: Setup = {}) {
  const close = vi.fn();
  const current = signal<AppOrder | undefined>(shown);
  const data: OrderDetailsDialogData = {
    order: current.asReadonly(),
    canManage,
    canCorrectRecordsInUse,
  };
  TestBed.configureTestingModule({
    providers: [
      { provide: MatDialogRef, useValue: { close } },
      { provide: MAT_DIALOG_DATA, useValue: data },
    ],
  });
  const fixture = TestBed.createComponent(OrderDetailsDialog);
  await fixture.whenStable();
  return { fixture, close, current, root: fixture.nativeElement as HTMLElement };
}

const text = (element: Element | null | undefined) =>
  element?.textContent?.replace(/\s+/g, ' ').trim() ?? '';

function buttonNamed(root: HTMLElement, name: string): HTMLButtonElement | undefined {
  return Array.from(root.querySelectorAll<HTMLButtonElement>('button')).find(
    (button) => (button.getAttribute('aria-label') ?? text(button)) === name,
  );
}

const isDisabled = (button: HTMLButtonElement | undefined) =>
  button?.disabled === true || button?.getAttribute('aria-disabled') === 'true';

const codeRows = (root: HTMLElement) =>
  Array.from(root.querySelectorAll('.order-codes li')).map((row) =>
    Array.from(row.children).map(text),
  );

const IN_USE_REASON =
  'این سفارش در ۳ آنالیز روزانه ثبت شده است؛ ویرایش و حذف آن ممکن نیست. افزودن کد MI همچنان ممکن است.';

describe('OrderDetailsDialog', () => {
  it('is headed «جزئیات سفارش <number>», the dialog’s title', async () => {
    const { root } = await render();

    const heading = root.querySelector('h2');
    expect(text(heading)).toBe('جزئیات سفارش ORD-5001');
    expect(heading?.hasAttribute('mat-dialog-title')).toBe(true);
  });

  it('lists every MI code beside its product, one row each, in a list named «کدهای MI»', async () => {
    const { root } = await render({ order: MIXED });

    expect(codeRows(root)).toEqual([
      ['1001', 'کابل 2.5'],
      ['2001', 'کابل مسی افشان دو رشته با روکش PVC و عایق XLPE'],
    ]);
    const list = root.querySelector('.order-codes');
    expect(text(root.querySelector(`#${list?.getAttribute('aria-labelledby')}`))).toBe('کدهای MI');
  });

  it('gives no daily-BOM count as a statistic', async () => {
    const { root } = await render({ order: MIXED });

    expect(text(root)).not.toContain('آنالیز روزانه');
  });

  it('shows the order as it now is when the list re-reads it', async () => {
    const { fixture, root, current } = await render();

    current.set(order({ orderNumber: 'ORD-7001' }));
    await fixture.whenStable();

    expect(text(root.querySelector('h2'))).toBe('جزئیات سفارش ORD-7001');
  });

  it('closes itself once its order is gone from the list', async () => {
    const { fixture, close, current } = await render();

    current.set(undefined);
    await fixture.whenStable();

    expect(close).toHaveBeenCalledWith();
  });

  it('offers a read-only role no way to change the order', async () => {
    const { root } = await render({ order: MIXED });

    for (const name of ['افزودن کد MI', 'ویرایش', 'حذف']) {
      expect(buttonNamed(root, name)).toBeUndefined();
    }
  });

  it.each([
    ['افزودن کد MI', 'addMiCode'],
    ['ویرایش', 'edit'],
    ['حذف', 'delete'],
  ])('closes with the writer’s choice of «%s»', async (name, action) => {
    const { root, close } = await render({ canManage: true });

    buttonNamed(root, name)?.click();

    expect(close).toHaveBeenCalledWith({ action, order: order() });
  });

  it('names its action buttons by their visible text alone', async () => {
    const { root } = await render({ canManage: true });

    for (const name of ['افزودن کد MI', 'ویرایش', 'حذف']) {
      expect(buttonNamed(root, name)?.hasAttribute('aria-label')).toBe(false);
    }
    expect(root.textContent).not.toContain('ویرایش و حذف آن ممکن نیست');
  });

  describe('Management, on an order with daily BOMs', () => {
    it('disables editing and deleting, and says why beside them', async () => {
      const { root } = await render({ order: MIXED, canManage: true });

      const reason = Array.from(root.querySelectorAll('p')).find(
        (paragraph) => text(paragraph) === IN_USE_REASON,
      );
      expect(reason).toBeDefined();
      for (const name of ['ویرایش', 'حذف']) {
        const button = buttonNamed(root, name);
        expect(isDisabled(button)).toBe(true);
        expect(button?.getAttribute('aria-describedby')?.split(' ')).toContain(reason?.id);
      }
    });

    it('asks for nothing when a disabled action is clicked', async () => {
      const { root, close } = await render({ order: MIXED, canManage: true });

      buttonNamed(root, 'ویرایش')?.click();
      buttonNamed(root, 'حذف')?.click();

      expect(close).not.toHaveBeenCalled();
    });

    it('still lets them add an MI code', async () => {
      const { root, close } = await render({ order: MIXED, canManage: true });

      const add = buttonNamed(root, 'افزودن کد MI');
      expect(isDisabled(add)).toBe(false);
      add?.click();
      expect(close).toHaveBeenCalledWith({ action: 'addMiCode', order: MIXED });
    });
  });

  it('leaves every action open to the System Admin, on an order with daily BOMs too', async () => {
    const { root } = await render({ order: MIXED, canManage: true, canCorrectRecordsInUse: true });

    for (const name of ['افزودن کد MI', 'ویرایش', 'حذف']) {
      expect(isDisabled(buttonNamed(root, name))).toBe(false);
    }
    expect(root.textContent).not.toContain('ویرایش و حذف آن ممکن نیست');
  });
});
