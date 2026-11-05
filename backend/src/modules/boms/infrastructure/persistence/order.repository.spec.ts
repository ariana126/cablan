import { toDomain, toPersistence } from './order.repository';

describe('the order row mapping', () => {
  it('round-trips an order with its MI codes in assignment order', () => {
    const record = {
      id: 'order-1',
      orderNumber: 'ORD-5001',
      miCodes: [
        {
          standardBomId: 'standard-bom-2001',
          miCode: '2001',
          productId: 'product-cable-4',
          productName: 'کابل 4',
        },
        {
          standardBomId: 'standard-bom-1001',
          miCode: '1001',
          productId: 'product-cable-2.5',
          productName: 'کابل 2.5',
        },
      ],
    };

    const order = toDomain(record);

    expect(order.releaseEvents()).toEqual([]);
    expect(toPersistence(order)).toEqual(record);
  });
});
