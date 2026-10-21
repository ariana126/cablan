import { TestBed } from '@angular/core/testing';
import { describe, expect, it } from 'vitest';

import { ActiveFilterChip } from './active-filter-chips';
import { ActiveFilters } from './active-filters';

const chips: readonly ActiveFilterChip[] = [
  {
    id: 'brand-kablan',
    filterKey: 'brands',
    filterValue: 'کابلان',
    column: 'برند',
    value: 'کابلان',
    removeLabel: 'حذف فیلتر برند: کابلان',
  },
  {
    id: 'brand-legrand',
    filterKey: 'brands',
    filterValue: 'لگراند',
    column: 'برند',
    value: 'لگراند',
    removeLabel: 'حذف فیلتر برند: لگراند',
  },
  {
    id: 'inspector',
    filterKey: 'inspectors',
    filterValue: 'مریم',
    column: 'کنترلگر',
    value: 'مریم',
    removeLabel: 'حذف فیلتر کنترلگر: مریم',
  },
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

  it('shows two values of one column as two separate chips', async () => {
    const { root } = await render(chips);

    const texts = Array.from(root.querySelectorAll('.active-filters__chip')).map((chip) =>
      chip.textContent?.trim(),
    );
    expect(texts).toEqual(['برند: کابلان', 'برند: لگراند', 'کنترلگر: مریم']);
  });

  it('emits the chip whose remove button was pressed', async () => {
    const { fixture, root } = await render(chips);
    const removed: ActiveFilterChip[] = [];
    fixture.componentInstance.removed.subscribe((chip) => removed.push(chip));

    root.querySelector<HTMLButtonElement>('button[aria-label="حذف فیلتر برند: لگراند"]')!.click();

    expect(removed).toEqual([chips[1]]);
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
