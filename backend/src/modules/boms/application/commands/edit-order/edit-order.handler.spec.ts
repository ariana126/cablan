import {
  OrderMiCodeNotFound,
  OrderNumberTaken,
} from '@boms/application/exceptions';
import { StandardBomLookup } from '@boms/application/service/standard-bom-lookup';
import { InMemoryOrderRepository } from '@boms/application/support/in-memory-order-repository';
import { StubQueryBus } from '@boms/application/support/stub-query-bus';
import { stubStandardBoms } from '@boms/application/support/stub-standard-boms';
import { OrderEdited } from '@boms/domain/events/order-edited.event';
import { Order } from '@boms/domain/order.aggregate';
import { OrderMiCode } from '@boms/domain/value/order-mi-code.vo';
import { OrderNumber } from '@boms/domain/value/order-number.vo';
import {
  ApplyToRelatedRecords,
  RecordDependencies,
  RecordHasDependents,
} from '@framework/application';
import { ImmediateUnitOfWork } from '@framework/application/support/immediate-unit-of-work';
import { StubCorrectionPropagator } from '@framework/application/support/stub-correction-propagator';
import { StubDependentsProbe } from '@framework/application/support/stub-dependents-probe';
import { EntityNotFound, Identity, Role } from '@framework/domain';
import { QueryBus } from '@nestjs/cqrs';

import { EditOrderCommand } from './edit-order.command';
import { EditOrderHandler } from './edit-order.handler';

const ADMIN_CORRECTION = ApplyToRelatedRecords.askedBy(Role.SystemAdmin, true);

function miCode(code: string): OrderMiCode {
  return OrderMiCode.of(
    Identity.fromString(`standard-bom-${code}`),
    code,
    Identity.fromString('product-cable-2.5'),
    'کابل 2.5',
  );
}

function makeSut() {
  const queryBus = new StubQueryBus();
  stubStandardBoms(
    queryBus,
    ['1001', '1002', '1003'].map((code) => ({
      id: `standard-bom-${code}`,
      miCode: code,
      productId: 'product-cable-2.5',
      productName: 'کابل 2.5',
    })),
  );
  const orderRepository = new InMemoryOrderRepository();
  const order = orderRepository.seed(
    Order.define(OrderNumber.fromString('ORD-5001'), [
      miCode('1001'),
      miCode('1002'),
    ]),
  );
  const probe = new StubDependentsProbe();
  const propagator = new StubCorrectionPropagator();
  const sut = new EditOrderHandler(
    orderRepository,
    new StandardBomLookup(queryBus as unknown as QueryBus),
    new RecordDependencies([probe], [propagator]),
    new ImmediateUnitOfWork(),
  );
  const inUse = () =>
    probe.given({ type: 'order', id: order.id.asString() }, [
      { kind: 'daily-bom', name: 'ORD-5001' },
    ]);
  return { sut, orderRepository, order, propagator, inUse };
}

async function codesOf(
  orderRepository: InMemoryOrderRepository,
  order: Order,
): Promise<string[]> {
  const stored = await orderRepository.get(order.id);
  return stored.miCodes().map((assigned) => assigned.miCode());
}

async function numberOf(
  orderRepository: InMemoryOrderRepository,
  order: Order,
): Promise<string> {
  const stored = await orderRepository.get(order.id);
  return stored.orderNumber().asString();
}

describe('EditOrderHandler', () => {
  describe('an order without daily BOMs', () => {
    it('renumbers it and replaces its MI codes', async () => {
      const { sut, orderRepository, order, propagator } = makeSut();

      await sut.execute(
        new EditOrderCommand(order.id, OrderNumber.fromString('ORD-7002'), [
          '1001',
        ]),
      );

      expect(await numberOf(orderRepository, order)).toBe('ORD-7002');
      expect(await codesOf(orderRepository, order)).toEqual(['1001']);
      expect(orderRepository.releasedEvents).toEqual([expect.any(OrderEdited)]);
      expect(propagator.propagated).toEqual([]);
    });

    it('leaves what the edit does not name as it was', async () => {
      const { sut, orderRepository, order } = makeSut();

      await sut.execute(
        new EditOrderCommand(order.id, undefined, ['1002', '1003']),
      );

      const saved = await orderRepository.get(order.id);
      expect(saved.orderNumber().asString()).toBe('ORD-5001');
      expect(await codesOf(orderRepository, order)).toEqual(['1002', '1003']);
    });

    it('refuses a number another order has, changing nothing', async () => {
      const { sut, orderRepository, order } = makeSut();
      orderRepository.seed(
        Order.define(OrderNumber.fromString('ORD-5002'), [miCode('1003')]),
      );

      await expect(
        sut.execute(
          new EditOrderCommand(order.id, OrderNumber.fromString('ORD-۵۰۰۲')),
        ),
      ).rejects.toBeInstanceOf(OrderNumberTaken);
      expect(await numberOf(orderRepository, order)).toBe('ORD-5001');
    });

    it('refuses an MI code no standard BOM has', async () => {
      const { sut, orderRepository, order } = makeSut();

      await expect(
        sut.execute(new EditOrderCommand(order.id, undefined, ['9999'])),
      ).rejects.toBeInstanceOf(OrderMiCodeNotFound);
      expect(await codesOf(orderRepository, order)).toEqual(['1001', '1002']);
    });

    it('refuses an unknown order', async () => {
      const { sut } = makeSut();

      await expect(
        sut.execute(
          new EditOrderCommand(Identity.new(), OrderNumber.fromString('X')),
        ),
      ).rejects.toBeInstanceOf(EntityNotFound);
    });
  });

  describe('an order with daily BOMs', () => {
    it('cannot be renumbered, changing nothing', async () => {
      const { sut, orderRepository, order, inUse } = makeSut();
      inUse();

      await expect(
        sut.execute(
          new EditOrderCommand(order.id, OrderNumber.fromString('ORD-5010')),
        ),
      ).rejects.toBeInstanceOf(RecordHasDependents);
      expect(await numberOf(orderRepository, order)).toBe('ORD-5001');
    });

    it.each([
      ['Management', ApplyToRelatedRecords.askedBy(Role.Management, true)],
      ['the System Admin', ADMIN_CORRECTION],
    ])('cannot lose an MI code, not even by %s', async (_who, apply) => {
      const { sut, orderRepository, order, inUse } = makeSut();
      inUse();

      await expect(
        sut.execute(new EditOrderCommand(order.id, undefined, ['1001'], apply)),
      ).rejects.toBeInstanceOf(RecordHasDependents);
      expect(await codesOf(orderRepository, order)).toEqual(['1001', '1002']);
    });

    it('is renumbered by the System Admin’s correction, carried into its daily BOMs by the number they hold', async () => {
      const { sut, orderRepository, order, propagator, inUse } = makeSut();
      inUse();

      await sut.execute(
        new EditOrderCommand(
          order.id,
          OrderNumber.fromString('ORD-5010'),
          ['1002', '1001'],
          ADMIN_CORRECTION,
        ),
      );

      expect(await numberOf(orderRepository, order)).toBe('ORD-5010');
      expect(propagator.propagated).toEqual([
        {
          reference: { type: 'order', id: order.id.asString() },
          correction: { name: 'ORD-5010' },
        },
      ]);
      expect(propagator.previousFields).toEqual([{ name: 'ORD-5001' }]);
    });

    it('is renumbered by the System Admin’s correction resending its MI codes in another order, which keeps them and records no MI-code change', async () => {
      const { sut, orderRepository, order, inUse } = makeSut();
      inUse();
      const assigned = order.miCodes();

      await sut.execute(
        new EditOrderCommand(
          order.id,
          OrderNumber.fromString('ORD-5010'),
          ['۱۰۰۲', '1001'],
          ADMIN_CORRECTION,
        ),
      );

      const saved = await orderRepository.get(order.id);
      expect(saved.miCodes()).toEqual(assigned);
      const [edited] = orderRepository.releasedEvents as OrderEdited[];
      expect(edited.changes.map(({ field }) => field)).toEqual(['orderNumber']);
    });

    it('is not renumbered onto a taken number, even by the System Admin, carrying nothing', async () => {
      const { sut, orderRepository, order, propagator, inUse } = makeSut();
      inUse();
      orderRepository.seed(
        Order.define(OrderNumber.fromString('ORD-5002'), [miCode('1003')]),
      );

      await expect(
        sut.execute(
          new EditOrderCommand(
            order.id,
            OrderNumber.fromString('ORD-5002'),
            undefined,
            ADMIN_CORRECTION,
          ),
        ),
      ).rejects.toBeInstanceOf(OrderNumberTaken);
      expect(propagator.propagated).toEqual([]);
    });
  });
});
