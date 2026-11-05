import { AppOrder } from '../../../core/orders/orders-gateway';
import { AppStandardBom } from '../../../core/standard-boms/standard-boms-gateway';

/** A standard BOM as the orders page needs it: its MI code and brand; the rest is filler. */
export function standardBom(id: string, miCode: string, brand: string): AppStandardBom {
  return {
    id,
    miCode,
    brand,
    standardLength: 100,
    active: true,
    description: '',
    productId: 'p1',
    components: [],
  };
}

export const STANDARD_BOMS: readonly AppStandardBom[] = [
  standardBom('s1', '1001', 'لگراند'),
  standardBom('s2', '1002', 'کابلان'),
  standardBom('s3', '2001', 'افق'),
];

/** «ORD-5001» holding «1001» and «1002», both of «کابل 2.5». */
export function order(overrides: Partial<AppOrder> = {}): AppOrder {
  return {
    id: 'o1',
    orderNumber: 'ORD-5001',
    miCodes: [
      { standardBomId: 's1', miCode: '1001', productId: 'p1', productName: 'کابل 2.5' },
      { standardBomId: 's2', miCode: '1002', productId: 'p1', productName: 'کابل 2.5' },
    ],
    dailyBomCount: 0,
    ...overrides,
  };
}
