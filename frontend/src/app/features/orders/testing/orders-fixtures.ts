import { AppOrder } from '../../../core/orders/orders-gateway';
import { AppStandardBom } from '../../../core/standard-boms/standard-boms-gateway';
import { MiCodeOption } from '../mi-code-option';

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

/** What the order dialogs offer: «1001» and «1002» of «کابل 2.5», «2001» of «کابل 4». */
export const MI_CODE_OPTIONS: readonly MiCodeOption[] = [
  { miCode: '1001', productName: 'کابل 2.5' },
  { miCode: '1002', productName: 'کابل 2.5' },
  { miCode: '2001', productName: 'کابل 4' },
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
