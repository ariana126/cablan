import { describe, expect, it } from 'vitest';

import { multiValueFilterChips, withoutFilterValue } from './active-filter-chips';

interface Selections {
  brands: string[] | undefined;
  activeStatuses: boolean[] | undefined;
}

const fields = [
  { key: 'brands', label: 'برند' },
  { key: 'activeStatuses', label: 'فعال' },
] as const;

const label = (_key: string, value: string | boolean) =>
  typeof value === 'boolean' ? (value ? 'بله' : 'خیر') : value;

describe('multiValueFilterChips', () => {
  it('makes one chip per chosen value, not one per field', () => {
    const selections: Selections = { brands: ['کابلان', 'لگراند'], activeStatuses: undefined };

    const chips = multiValueFilterChips(fields, selections, label);

    expect(chips.map((chip) => [chip.column, chip.value, chip.removeLabel])).toEqual([
      ['برند', 'کابلان', 'حذف فیلتر برند: کابلان'],
      ['برند', 'لگراند', 'حذف فیلتر برند: لگراند'],
    ]);
  });

  it('makes no chip for a field without a filter', () => {
    const selections: Selections = { brands: undefined, activeStatuses: undefined };

    expect(multiValueFilterChips(fields, selections, label)).toEqual([]);
  });

  it('reads each value through the given label, in field order', () => {
    const selections: Selections = { brands: ['کابلان'], activeStatuses: [true, false] };

    expect(multiValueFilterChips(fields, selections, label).map((chip) => chip.value)).toEqual([
      'کابلان',
      'بله',
      'خیر',
    ]);
  });

  it('gives every chip a distinct id, even where a string and a boolean print alike', () => {
    const chips = multiValueFilterChips(
      [
        { key: 'a', label: 'الف' },
        { key: 'b', label: 'ب' },
      ],
      { a: ['true', 'x'], b: [true] },
      label,
    );

    expect(new Set(chips.map((chip) => chip.id)).size).toBe(3);
  });

  it('keeps a filter that matches nothing visible as a single chip', () => {
    const selections: Selections = { brands: [], activeStatuses: undefined };

    const chips = multiValueFilterChips(fields, selections, label);

    expect(chips.map((chip) => [chip.value, chip.removeLabel])).toEqual([
      ['هیچ‌کدام', 'حذف فیلتر برند: هیچ‌کدام'],
    ]);
  });
});

describe('withoutFilterValue', () => {
  const selections: Selections = { brands: ['کابلان', 'لگراند'], activeStatuses: [true] };

  it('drops only the removed chip’s value and keeps the field’s others', () => {
    const [kablan] = multiValueFilterChips(fields, selections, label);

    expect(withoutFilterValue(selections, kablan)).toEqual({
      brands: ['لگراند'],
      activeStatuses: [true],
    });
  });

  it('lifts the field’s filter once its last value is removed', () => {
    const active = multiValueFilterChips(fields, selections, label).find(
      (chip) => chip.column === 'فعال',
    )!;

    expect(withoutFilterValue(selections, active)).toEqual({
      brands: ['کابلان', 'لگراند'],
      activeStatuses: undefined,
    });
  });

  it('lifts a filter that matched nothing', () => {
    const empty: Selections = { brands: [], activeStatuses: undefined };
    const [chip] = multiValueFilterChips(fields, empty, label);

    expect(withoutFilterValue(empty, chip)).toEqual({
      brands: undefined,
      activeStatuses: undefined,
    });
  });

  it('leaves the selections it was given untouched', () => {
    const [kablan] = multiValueFilterChips(fields, selections, label);

    withoutFilterValue(selections, kablan);

    expect(selections.brands).toEqual(['کابلان', 'لگراند']);
  });
});
