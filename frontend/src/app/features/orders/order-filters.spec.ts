import { describe, expect, it } from 'vitest';

import { AppOrder } from '../../core/orders/orders-gateway';
import {
  filterOrders,
  hasActiveFilters,
  NO_ORDER_FILTERS,
  OrderFilters,
  orderProducts,
  productOptions,
} from './order-filters';
import { order } from './testing/orders-fixtures';

const CABLE_25 = { id: 'p1', name: 'کابل 2.5' };
const CABLE_4 = { id: 'p2', name: 'کابل 4' };

/** «ORD-5001»: two codes of «کابل 2.5», no daily BOMs. */
const FIRST = order();
/** One code of each product, with daily BOMs. */
const SECOND = order({
  id: 'o2',
  orderNumber: 'SO-7702',
  miCodes: [
    { standardBomId: 's3', miCode: '2001', productId: 'p2', productName: 'کابل 4' },
    { standardBomId: 's1', miCode: '1001', productId: 'p1', productName: 'کابل 2.5' },
  ],
  dailyBomCount: 3,
});
const THIRD = order({
  id: 'o3',
  orderNumber: 'Ab-9',
  miCodes: [{ standardBomId: 's4', miCode: 'MI-77', productId: 'p3', productName: 'سیم افشان' }],
});
const ORDERS: readonly AppOrder[] = [FIRST, SECOND, THIRD];

const filtered = (filters: Partial<OrderFilters>) =>
  filterOrders(ORDERS, { ...NO_ORDER_FILTERS, ...filters }).map((found) => found.orderNumber);

describe('orderProducts', () => {
  it('lists each product of an order once, in assignment order', () => {
    expect(orderProducts(FIRST)).toEqual([CABLE_25]);
    expect(orderProducts(SECOND)).toEqual([CABLE_4, CABLE_25]);
  });
});

describe('productOptions', () => {
  it('lists every product of every order once, by name', () => {
    expect(productOptions(ORDERS)).toEqual([{ id: 'p3', name: 'سیم افشان' }, CABLE_25, CABLE_4]);
  });
});

describe('filterOrders', () => {
  it('keeps every order when nothing is searched or filtered', () => {
    expect(filtered({})).toEqual(['ORD-5001', 'SO-7702', 'Ab-9']);
  });

  it('finds an order by part of its number, whatever the case', () => {
    expect(filtered({ query: 'so-77' })).toEqual(['SO-7702']);
    expect(filtered({ query: 'aB' })).toEqual(['Ab-9']);
  });

  it('finds an order by part of any of its MI codes', () => {
    expect(filtered({ query: '2001' })).toEqual(['SO-7702']);
    expect(filtered({ query: 'mi-7' })).toEqual(['Ab-9']);
  });

  it('finds an order by part of any of its product names', () => {
    expect(filtered({ query: 'افشان' })).toEqual(['Ab-9']);
    expect(filtered({ query: 'کابل 4' })).toEqual(['SO-7702']);
  });

  it('reads Persian and Arabic-Indic digits as Latin ones, on both sides', () => {
    expect(filtered({ query: '۷۷۰' })).toEqual(['SO-7702']);
    expect(filtered({ query: '٥٠٠١' })).toEqual(['ORD-5001']);
    expect(
      filterOrders([order({ orderNumber: 'ORD-۱۲' })], { ...NO_ORDER_FILTERS, query: '12' }),
    ).toHaveLength(1);
  });

  it('ignores the spaces around a search', () => {
    expect(filtered({ query: '  5001 ' })).toEqual(['ORD-5001']);
  });

  it('keeps the orders holding a code of the chosen product', () => {
    expect(filtered({ productId: 'p1' })).toEqual(['ORD-5001', 'SO-7702']);
    expect(filtered({ productId: 'p2' })).toEqual(['SO-7702']);
  });

  it('keeps the orders with, or without, daily BOMs', () => {
    expect(filtered({ dailyBoms: 'with' })).toEqual(['SO-7702']);
    expect(filtered({ dailyBoms: 'without' })).toEqual(['ORD-5001', 'Ab-9']);
  });

  it('combines the search and both filters', () => {
    expect(filtered({ query: '1001', productId: 'p1', dailyBoms: 'without' })).toEqual([
      'ORD-5001',
    ]);
    expect(filtered({ query: 'ORD', productId: 'p2' })).toEqual([]);
  });
});

describe('hasActiveFilters', () => {
  it('is false only when nothing is searched or filtered', () => {
    expect(hasActiveFilters(NO_ORDER_FILTERS)).toBe(false);
    expect(hasActiveFilters({ ...NO_ORDER_FILTERS, query: '   ' })).toBe(false);
    expect(hasActiveFilters({ ...NO_ORDER_FILTERS, query: 'x' })).toBe(true);
    expect(hasActiveFilters({ ...NO_ORDER_FILTERS, productId: 'p1' })).toBe(true);
    expect(hasActiveFilters({ ...NO_ORDER_FILTERS, dailyBoms: 'with' })).toBe(true);
  });
});
