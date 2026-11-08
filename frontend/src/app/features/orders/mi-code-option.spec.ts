import { describe, expect, it } from 'vitest';

import { AppProduct } from '../../core/products/products-gateway';
import { MiCodeOption, miCodeOptionLabel, miCodeOptions, offeredMiCodes } from './mi-code-option';
import { standardBom } from './testing/orders-fixtures';

const PRODUCTS: readonly AppProduct[] = [
  { id: 'p1', name: 'کابل 2.5', components: [] },
  { id: 'p2', name: 'کابل 4', components: [] },
];

const OPTIONS: readonly MiCodeOption[] = [
  { miCode: '1001', productName: 'کابل 2.5' },
  { miCode: '1002', productName: 'کابل 2.5' },
  { miCode: '2001', productName: 'کابل 4' },
];

const codes = (options: readonly MiCodeOption[]) => options.map((option) => option.miCode);

describe('miCodeOptions', () => {
  it('names each standard BOM’s MI code with its product', () => {
    const options = miCodeOptions(
      [
        standardBom('s1', '1001', 'لگراند'),
        { ...standardBom('s3', '2001', 'افق'), productId: 'p2' },
      ],
      PRODUCTS,
    );

    expect(options).toEqual([
      { miCode: '1001', productName: 'کابل 2.5' },
      { miCode: '2001', productName: 'کابل 4' },
    ]);
  });

  it('leaves the product blank when it is not among the products read', () => {
    const options = miCodeOptions([{ ...standardBom('s9', '9001', ''), productId: 'gone' }], []);

    expect(options).toEqual([{ miCode: '9001', productName: '' }]);
  });
});

describe('miCodeOptionLabel', () => {
  it('reads the code first, then its product', () => {
    expect(miCodeOptionLabel(OPTIONS[0])).toBe('1001 — کابل 2.5');
  });

  it('reads the bare code when the product is unknown', () => {
    expect(miCodeOptionLabel({ miCode: '9001', productName: '' })).toBe('9001');
  });
});

describe('offeredMiCodes', () => {
  it('offers every code not already chosen', () => {
    expect(codes(offeredMiCodes(OPTIONS, '', ['1002']))).toEqual(['1001', '2001']);
  });

  it('narrows the offer by part of the code or of the product name', () => {
    expect(codes(offeredMiCodes(OPTIONS, '200', []))).toEqual(['2001']);
    expect(codes(offeredMiCodes(OPTIONS, 'کابل 2', []))).toEqual(['1001', '1002']);
  });

  it('reads a code typed in Persian digits', () => {
    expect(codes(offeredMiCodes(OPTIONS, '۱۰۰۲', []))).toEqual(['1002']);
  });
});
