import { form } from '@angular/forms/signals';
import { TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import { describe, expect, it } from 'vitest';

import {
  DateRangeFormModel,
  EMPTY_DATE_RANGE,
  appliedDateRange,
  dateRangeSchema,
  toIsoDateRange,
} from './date-range-form';

const rangeForm = (initial: DateRangeFormModel) =>
  TestBed.runInInjectionContext(() => {
    const model = signal(initial);
    return { model, tree: form(model, dateRangeSchema) };
  });

describe('dateRangeSchema', () => {
  it('accepts a range whose end follows its start', () => {
    const { tree } = rangeForm(
      appliedDateRange(new Date(2024, 5, 21, 8, 0), new Date(2024, 5, 21, 9, 0)),
    );

    expect(tree.to().errors()).toEqual([]);
  });

  it('rejects a range that ends before it starts', () => {
    const { tree } = rangeForm(
      appliedDateRange(new Date(2024, 5, 21, 9, 0), new Date(2024, 5, 21, 8, 0)),
    );

    expect(tree.to().errors()[0].message).toBe('پایان بازه نباید پیش از آغاز آن باشد.');
  });

  it('leaves a half-open range alone — one bound is a perfectly good filter', () => {
    const openEnd = rangeForm({ ...EMPTY_DATE_RANGE, from: new Date(2024, 5, 21, 9, 0) });
    const openStart = rangeForm({ ...EMPTY_DATE_RANGE, to: new Date(2024, 5, 21, 9, 0) });

    expect(openEnd.tree.to().errors()).toEqual([]);
    expect(openStart.tree.to().errors()).toEqual([]);
  });

  it('accepts the empty range every page starts from', () => {
    const { tree } = rangeForm(EMPTY_DATE_RANGE);

    expect(tree.to().errors()).toEqual([]);
  });
});

describe('dateRangeSchema — unreadable text', () => {
  it('rejects a bound whose control reported text it could not read', () => {
    const { tree } = rangeForm({ ...EMPTY_DATE_RANGE, fromUnparseable: true });

    expect(tree.from().errors()[0].message).toContain('قالب تاریخ و زمان معتبر نیست');
  });

  it('rejects an unreadable upper bound too', () => {
    const { tree } = rangeForm({ ...EMPTY_DATE_RANGE, toUnparseable: true });

    expect(tree.to().errors()[0].message).toContain('قالب تاریخ و زمان معتبر نیست');
  });
});

describe('toIsoDateRange', () => {
  it('sends each bound as an ISO instant', () => {
    const from = new Date(2024, 5, 21, 8, 30);
    const to = new Date(2024, 6, 22, 9, 15);

    expect(toIsoDateRange(appliedDateRange(from, to))).toEqual({
      from: from.toISOString(),
      to: to.toISOString(),
    });
  });

  it('omits an open bound rather than sending null', () => {
    expect(toIsoDateRange(EMPTY_DATE_RANGE)).toEqual({ from: undefined, to: undefined });
  });
});
