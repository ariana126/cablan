import { TestBed } from '@angular/core/testing';
import { describe, expect, it } from 'vitest';

import { ActiveFilterChip, ActiveFilters } from './active-filters';

const chips: readonly ActiveFilterChip[] = [
  { id: 'brand', column: 'برند', value: 'کابلان', removeLabel: 'حذف فیلتر برند: کابلان' },
  { id: 'inspector', column: 'کنترلگر', value: 'مریم', removeLabel: 'حذف فیلتر کنترلگر: مریم' },
];

async function render(value: readonly ActiveFilterChip[]) {
  const fixture = TestBed.createComponent(ActiveFilters);
  fixture.componentRef.setInput('chips', value);
  await fixture.whenStable();
  return { fixture, root: fixture.nativeElement as HTMLElement };
}

describe('ActiveFilters', () => {
  it('renders nothing when no filter is active', async () => {
    const { root } = await render([]);

    expect(root.querySelector('button')).toBeNull();
    expect(root.textContent?.trim()).toBe('');
  });

  it('shows each active filter as "column: value"', async () => {
    const { root } = await render(chips);

    expect(root.textContent).toContain('برند:');
    expect(root.textContent).toContain('کابلان');
    expect(root.textContent).toContain('کنترلگر:');
  });

  it('gives every chip a remove button named for what it removes', async () => {
    const { root } = await render(chips);

    const labels = Array.from(root.querySelectorAll('button')).map((b) =>
      b.getAttribute('aria-label'),
    );
    expect(labels).toContain('حذف فیلتر برند: کابلان');
    expect(labels).toContain('حذف فیلتر کنترلگر: مریم');
  });

  it('emits the id of the chip whose remove button was pressed', async () => {
    const { fixture, root } = await render(chips);
    const removed: string[] = [];
    fixture.componentInstance.removed.subscribe((id) => removed.push(id));

    root.querySelector<HTMLButtonElement>('button[aria-label="حذف فیلتر برند: کابلان"]')!.click();

    expect(removed).toEqual(['brand']);
  });

  it('offers to clear all of them at once', async () => {
    const { fixture, root } = await render(chips);
    let cleared = 0;
    fixture.componentInstance.clearedAll.subscribe(() => cleared++);

    const clear = Array.from(root.querySelectorAll('button')).find(
      (b) => b.textContent?.trim() === 'پاک کردن همه',
    );
    clear!.click();

    expect(cleared).toBe(1);
  });
});
