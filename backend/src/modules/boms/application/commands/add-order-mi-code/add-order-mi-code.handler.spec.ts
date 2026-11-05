import { OrderMiCodeNotFound } from '@boms/application/exceptions';
import { StandardBomLookup } from '@boms/application/service/standard-bom-lookup';
import { InMemoryOrderRepository } from '@boms/application/support/in-memory-order-repository';
import { StubQueryBus } from '@boms/application/support/stub-query-bus';
import { stubStandardBoms } from '@boms/application/support/stub-standard-boms';
import { OrderMiCodeAdded } from '@boms/domain/events/order-mi-code-added.event';
import { OrderMiCodeAlreadyAssigned } from '@boms/domain/exceptions/order-mi-code-already-assigned.exception';
import { Order } from '@boms/domain/order.aggregate';
import { OrderMiCode } from '@boms/domain/value/order-mi-code.vo';
import { OrderNumber } from '@boms/domain/value/order-number.vo';
import { EntityNotFound, Identity } from '@framework/domain';
import { QueryBus } from '@nestjs/cqrs';

import { AddOrderMiCodeCommand } from './add-order-mi-code.command';
import { AddOrderMiCodeHandler } from './add-order-mi-code.handler';

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
      id: 'standard-bom-1002',
      miCode: '1002',
      productId: 'product-cable-2.5',
      productName: 'کابل 2.5',
    },
  ]);
  const orderRepository = new InMemoryOrderRepository();
  const order = orderRepository.seed(
    Order.define(OrderNumber.fromString('ORD-5001'), [
      OrderMiCode.of(
        Identity.fromString('standard-bom-1001'),
        '1001',
        Identity.fromString('product-cable-2.5'),
        'کابل 2.5',
      ),
    ]),
  );
  const sut = new AddOrderMiCodeHandler(
    orderRepository,
    new StandardBomLookup(queryBus as unknown as QueryBus),
  );
  return { sut, orderRepository, order };
}

// Adding an MI code is never guarded by the order's daily BOMs: it changes
// none of them (the handler is not even given the dependents).
describe('AddOrderMiCodeHandler', () => {
  it('adds the MI code after the ones the order has', async () => {
    const { sut, orderRepository, order } = makeSut();

    await sut.execute(new AddOrderMiCodeCommand(order.id, '1002'));

    const saved = await orderRepository.get(order.id);
    expect(saved.miCodes().map((miCode) => miCode.miCode())).toEqual([
      '1001',
      '1002',
    ]);
    expect(orderRepository.releasedEvents).toEqual([
      expect.any(OrderMiCodeAdded),
    ]);
  });

  it('refuses an MI code the order has, adding nothing', async () => {
    const { sut, orderRepository, order } = makeSut();

    await expect(
      sut.execute(new AddOrderMiCodeCommand(order.id, '۱۰۰۱')),
    ).rejects.toBeInstanceOf(OrderMiCodeAlreadyAssigned);
    const kept = await orderRepository.get(order.id);
    expect(kept.miCodes()).toHaveLength(1);
  });

  it('refuses an MI code no standard BOM has', async () => {
    const { sut, order } = makeSut();

    await expect(
      sut.execute(new AddOrderMiCodeCommand(order.id, '9999')),
    ).rejects.toBeInstanceOf(OrderMiCodeNotFound);
  });

  it('refuses an unknown order', async () => {
    const { sut } = makeSut();

    await expect(
      sut.execute(new AddOrderMiCodeCommand(Identity.new(), '1002')),
    ).rejects.toBeInstanceOf(EntityNotFound);
  });
});
