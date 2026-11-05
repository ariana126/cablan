import {
  OrderMiCodeNotFound,
  OrderNumberTaken,
} from '@boms/application/exceptions';
import { StandardBomLookup } from '@boms/application/service/standard-bom-lookup';
import { InMemoryOrderRepository } from '@boms/application/support/in-memory-order-repository';
import { StubQueryBus } from '@boms/application/support/stub-query-bus';
import { stubStandardBoms } from '@boms/application/support/stub-standard-boms';
import { OrderDefined } from '@boms/domain/events/order-defined.event';
import { OrderMiCodeAlreadyAssigned } from '@boms/domain/exceptions/order-mi-code-already-assigned.exception';
import { OrderNumber } from '@boms/domain/value/order-number.vo';
import { Identity } from '@framework/domain';
import { QueryBus } from '@nestjs/cqrs';

import { DefineOrderCommand } from './define-order.command';
import { DefineOrderHandler } from './define-order.handler';

function makeSut() {
  const queryBus = new StubQueryBus();
  stubStandardBoms(queryBus, [
    {
      id: 'standard-bom-1001',
      miCode: '1001',
      productId: 'product-cable-2.5',
      productName: 'کابل 2.5',
    },
    {
      id: 'standard-bom-2001',
      miCode: '2001',
      productId: 'product-cable-4',
      productName: 'کابل 4',
    },
  ]);
  const orderRepository = new InMemoryOrderRepository();
  const sut = new DefineOrderHandler(
    orderRepository,
    new StandardBomLookup(queryBus as unknown as QueryBus),
  );
  return { sut, orderRepository };
}

describe('DefineOrderHandler', () => {
  it('defines the order with the standard BOMs its MI codes name, products of either kind', async () => {
    const { sut, orderRepository } = makeSut();

    const id = await sut.execute(
      new DefineOrderCommand(OrderNumber.fromString('ORD-5001'), [
        '1001',
        '2001',
      ]),
    );

    const order = await orderRepository.get(Identity.fromString(id));
    expect(order.orderNumber().asString()).toBe('ORD-5001');
    expect(
      order.miCodes().map((miCode) => [miCode.miCode(), miCode.productName()]),
    ).toEqual([
      ['1001', 'کابل 2.5'],
      ['2001', 'کابل 4'],
    ]);
    expect(orderRepository.releasedEvents).toEqual([expect.any(OrderDefined)]);
  });

  it.each(['ORD-5001', 'ORD-۵۰۰۱'])(
    'refuses a number another order has (%s), defining nothing',
    async (typed) => {
      const { sut, orderRepository } = makeSut();
      await sut.execute(
        new DefineOrderCommand(OrderNumber.fromString('ORD-5001'), ['1001']),
      );

      await expect(
        sut.execute(
          new DefineOrderCommand(OrderNumber.fromString(typed), ['2001']),
        ),
      ).rejects.toBeInstanceOf(OrderNumberTaken);
      expect(orderRepository.list()).toHaveLength(1);
    },
  );

  it('refuses an MI code no standard BOM has, defining nothing', async () => {
    const { sut, orderRepository } = makeSut();

    await expect(
      sut.execute(
        new DefineOrderCommand(OrderNumber.fromString('ORD-5001'), ['9999']),
      ),
    ).rejects.toBeInstanceOf(OrderMiCodeNotFound);
    expect(orderRepository.list()).toEqual([]);
  });

  it('refuses one MI code given twice, Persian digits too', async () => {
    const { sut, orderRepository } = makeSut();

    await expect(
      sut.execute(
        new DefineOrderCommand(OrderNumber.fromString('ORD-5001'), [
          '1001',
          '۱۰۰۱',
        ]),
      ),
    ).rejects.toBeInstanceOf(OrderMiCodeAlreadyAssigned);
    expect(orderRepository.list()).toEqual([]);
  });
});
