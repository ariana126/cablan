import { TestBed } from '@angular/core/testing';
import { describe, expect, it, vi } from 'vitest';

import { AppOrder } from '../../core/orders/orders-gateway';
import { OrderDetailsPanel } from './order-details-panel';
import { order } from './testing/orders-fixtures';

const MIXED = order({
  miCodes: [
    { standardBomId: 's1', miCode: '1001', productId: 'p1', productName: 'کابل 2.5' },
    { standardBomId: 's3', miCode: '2001', productId: 'p2', productName: 'کابل 4' },
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
  const fixture = TestBed.createComponent(OrderDetailsPanel);
  fixture.componentRef.setInput('order', shown);
  fixture.componentRef.setInput('canManage', canManage);
  fixture.componentRef.setInput('canCorrectRecordsInUse', canCorrectRecordsInUse);
  await fixture.whenStable();
  const panel = fixture.componentInstance;
  const emitted = {
    addMiCode: vi.fn(),
    edit: vi.fn(),
    deleteOrder: vi.fn(),
    closed: vi.fn(),
  };
  panel.addMiCode.subscribe(emitted.addMiCode);
  panel.edit.subscribe(emitted.edit);
  panel.deleteOrder.subscribe(emitted.deleteOrder);
  panel.closed.subscribe(emitted.closed);
  return { fixture, panel, emitted, root: fixture.nativeElement as HTMLElement };
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

const IN_USE_REASON =
  'این سفارش در ۳ آنالیز روزانه ثبت شده است؛ ویرایش و حذف آن ممکن نیست. افزودن کد MI همچنان ممکن است.';

describe('OrderDetailsPanel', () => {
  it('is a region named by its heading «جزئیات سفارش <number>»', async () => {
    const { root } = await render();

    const section = root.querySelector('section');
    const heading = root.querySelector('h2');
    expect(text(heading)).toBe('جزئیات سفارش ORD-5001');
    expect(section?.getAttribute('aria-labelledby')).toBe(heading?.id);
  });

  it('lists every MI code with its product, and the daily-BOM count', async () => {
    const { root } = await render({ order: MIXED });

    const codes = Array.from(root.querySelectorAll('.order-details__codes li')).map(text);
    expect(codes).toEqual(['1001 کابل 2.5', '2001 کابل 4']);
    expect(text(root)).toContain('آنالیز روزانه ۳');
  });

  it('closes with «بستن جزئیات»', async () => {
    const { root, emitted } = await render();

    buttonNamed(root, 'بستن جزئیات')?.click();

    expect(emitted.closed).toHaveBeenCalled();
  });

  it('offers a read-only role no way to change the order', async () => {
    const { root } = await render({ order: MIXED });

    for (const name of ['افزودن کد MI', 'ویرایش', 'حذف']) {
      expect(buttonNamed(root, name)).toBeUndefined();
    }
  });

  it('offers a writer adding a code, editing and deleting, each asking for its own action', async () => {
    const { root, emitted } = await render({ canManage: true });

    buttonNamed(root, 'افزودن کد MI')?.click();
    buttonNamed(root, 'ویرایش')?.click();
    buttonNamed(root, 'حذف')?.click();

    expect(emitted.addMiCode).toHaveBeenCalledWith(order());
    expect(emitted.edit).toHaveBeenCalledWith(order());
    expect(emitted.deleteOrder).toHaveBeenCalledWith(order());
    expect(root.textContent).not.toContain('ویرایش و حذف آن ممکن نیست');
  });

  it('names its buttons by their visible text alone', async () => {
    const { root } = await render({ canManage: true });

    for (const name of ['افزودن کد MI', 'ویرایش', 'حذف']) {
      expect(buttonNamed(root, name)?.hasAttribute('aria-label')).toBe(false);
    }
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
      const { root, emitted } = await render({ order: MIXED, canManage: true });

      buttonNamed(root, 'ویرایش')?.click();
      buttonNamed(root, 'حذف')?.click();

      expect(emitted.edit).not.toHaveBeenCalled();
      expect(emitted.deleteOrder).not.toHaveBeenCalled();
    });

    it('still lets them add an MI code', async () => {
      const { root, emitted } = await render({ order: MIXED, canManage: true });

      const add = buttonNamed(root, 'افزودن کد MI');
      expect(isDisabled(add)).toBe(false);
      add?.click();
      expect(emitted.addMiCode).toHaveBeenCalledWith(MIXED);
    });
  });

  it('leaves every action open to the System Admin, on an order with daily BOMs too', async () => {
    const { root } = await render({ order: MIXED, canManage: true, canCorrectRecordsInUse: true });

    for (const name of ['افزودن کد MI', 'ویرایش', 'حذف']) {
      expect(isDisabled(buttonNamed(root, name))).toBe(false);
    }
    expect(root.textContent).not.toContain('ویرایش و حذف آن ممکن نیست');
  });

  it('moves focus to its heading when asked', async () => {
    const { root, panel } = await render();

    panel.focusHeading();

    expect(document.activeElement).toBe(root.querySelector('h2'));
  });
});
