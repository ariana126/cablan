import { describe, expect, it } from 'vitest';

import { AppOrder } from '../../core/orders/orders-gateway';
import { orderProducts, searchOrders } from './order-search';
import { order } from './testing/orders-fixtures';

const CABLE_25 = { id: 'p1', name: 'کابل 2.5' };
const CABLE_4 = { id: 'p2', name: 'کابل 4' };

/** «ORD-5001»: two codes of «کابل 2.5». */
const FIRST = order();
/** One code of each product. */
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

const found = (query: string) => searchOrders(ORDERS, query).map((each) => each.orderNumber);

describe('orderProducts', () => {
  it('lists each product of an order once, in assignment order', () => {
    expect(orderProducts(FIRST)).toEqual([CABLE_25]);
    expect(orderProducts(SECOND)).toEqual([CABLE_4, CABLE_25]);
  });
});

describe('searchOrders', () => {
  it('keeps every order, in the list’s order, when nothing is searched', () => {
    expect(found('')).toEqual(['ORD-5001', 'SO-7702', 'Ab-9']);
    expect(found('   ')).toEqual(['ORD-5001', 'SO-7702', 'Ab-9']);
  });

  it('finds an order by part of its number, whatever the case', () => {
    expect(found('so-77')).toEqual(['SO-7702']);
    expect(found('aB')).toEqual(['Ab-9']);
  });

  it('finds an order by part of any of its product names', () => {
    expect(found('افشان')).toEqual(['Ab-9']);
    expect(found('کابل 4')).toEqual(['SO-7702']);
    expect(found('کابل 2.5')).toEqual(['ORD-5001', 'SO-7702']);
  });

  it('does not search the MI codes, which the list does not show', () => {
    expect(found('mi-7')).toEqual([]);
  });

  it('reads Persian and Arabic-Indic digits as Latin ones, on both sides', () => {
    expect(found('۷۷۰')).toEqual(['SO-7702']);
    expect(found('٥٠٠١')).toEqual(['ORD-5001']);
    expect(searchOrders([order({ orderNumber: 'ORD-۱۲' })], '12')).toHaveLength(1);
  });

  it('ignores the spaces around a search', () => {
    expect(found('  5001 ')).toEqual(['ORD-5001']);
  });
});
