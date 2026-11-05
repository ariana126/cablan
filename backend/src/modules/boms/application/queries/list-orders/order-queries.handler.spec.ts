import { InMemoryOrderReadRepository } from '@boms/application/support/in-memory-order-read-repository';
import { OrderNumber } from '@boms/domain/value/order-number.vo';
import { EntityNotFound, Identity } from '@framework/domain';

import { GetOrderHandler } from '../get-order/get-order.handler';
import { GetOrderQuery } from '../get-order/get-order.query';
import { GetOrderByNumberHandler } from '../get-order-by-number/get-order-by-number.handler';
import { GetOrderByNumberQuery } from '../get-order-by-number/get-order-by-number.query';
import { ListOrdersHandler } from './list-orders.handler';
import { ListOrdersQuery } from './list-orders.query';
import { OrderReadModel } from './order.read-model';

const ORDER: OrderReadModel = {
  id: 'order-1',
  orderNumber: 'ORD-5001',
  miCodes: [
    {
      standardBomId: 'standard-bom-1001',
      miCode: '1001',
      productId: 'product-cable-2.5',
      productName: 'کابل 2.5',
    },
  ],
  dailyBomCount: 2,
};

const orders = () => new InMemoryOrderReadRepository().seed(ORDER);

describe('the order queries', () => {
  it('lists the orders as items', async () => {
    const sut = new ListOrdersHandler(orders());

    expect(await sut.execute(new ListOrdersQuery())).toEqual({
      items: [ORDER],
    });
  });

  it('gets an order by its id', async () => {
    const sut = new GetOrderHandler(orders());

    expect(
      await sut.execute(new GetOrderQuery(Identity.fromString('order-1'))),
    ).toEqual(ORDER);
  });

  it('answers an unknown id as not found', async () => {
    const sut = new GetOrderHandler(orders());

    await expect(
      sut.execute(new GetOrderQuery(Identity.fromString('order-9'))),
    ).rejects.toBeInstanceOf(EntityNotFound);
  });

  it('gets an order by its number, typed with Persian digits too', async () => {
    const sut = new GetOrderByNumberHandler(orders());

    expect(
      await sut.execute(
        new GetOrderByNumberQuery(OrderNumber.fromString('ORD-۵۰۰۱')),
      ),
    ).toEqual(ORDER);
  });

  it('answers an unknown number as not found, naming the number', async () => {
    const sut = new GetOrderByNumberHandler(orders());

    const lookup = sut.execute(
      new GetOrderByNumberQuery(OrderNumber.fromString('ORD-6001')),
    );

    await expect(lookup).rejects.toBeInstanceOf(EntityNotFound);
    await expect(lookup).rejects.toMatchObject({
      identifier: Identity.fromString('ORD-6001'),
    });
  });
});
