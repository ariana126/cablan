import { InMemoryBomRepository } from '@boms/application/support/in-memory-bom-repository';
import { InMemoryOrderRepository } from '@boms/application/support/in-memory-order-repository';
import { Bom } from '@boms/domain/bom.aggregate';
import { OrderDeleted } from '@boms/domain/events/order-deleted.event';
import { Order } from '@boms/domain/order.aggregate';
import { BomComponentLine } from '@boms/domain/value/bom-component-line.vo';
import { BomMaterialLine } from '@boms/domain/value/bom-material-line.vo';
import { OrderMiCode } from '@boms/domain/value/order-mi-code.vo';
import { OrderNumber } from '@boms/domain/value/order-number.vo';
import { TrackingNumber } from '@boms/domain/value/tracking-number.vo';
import { Weight } from '@boms/domain/value/weight.vo';
import {
  RecordDependencies,
  RecordHasDependents,
} from '@framework/application';
import { ImmediateUnitOfWork } from '@framework/application/support/immediate-unit-of-work';
import { StubDependentsProbe } from '@framework/application/support/stub-dependents-probe';
import { EntityNotFound, Identity, Role } from '@framework/domain';

import { DeleteOrderCommand } from './delete-order.command';
import { DeleteOrderHandler } from './delete-order.handler';

const STANDARD_BOM = Identity.fromString('standard-bom-1001');

function dailyBom(orderNumber: string, trackingNumber: string): Bom {
  return Bom.register(
    STANDARD_BOM,
    '1001',
    'Legrand',
    'کابل 2.5',
    305,
    OrderNumber.fromString(orderNumber),
    TrackingNumber.fromString(trackingNumber),
    undefined,
    'نیکروش',
    [
      BomComponentLine.of(Identity.new(), 'مغزی', [
        BomMaterialLine.of(Identity.new(), 'مسی', Weight.ofGrams(3)),
      ]),
    ],
  );
}

function makeSut() {
  const orderRepository = new InMemoryOrderRepository();
  const bomRepository = new InMemoryBomRepository();
  const order = orderRepository.seed(
    Order.define(OrderNumber.fromString('ORD-5001'), [
      OrderMiCode.of(
        STANDARD_BOM,
        '1001',
        Identity.fromString('product-cable-2.5'),
        'کابل 2.5',
      ),
    ]),
  );
  const probe = new StubDependentsProbe();
  const sut = new DeleteOrderHandler(
    orderRepository,
    bomRepository,
    new RecordDependencies([probe]),
    new ImmediateUnitOfWork(),
  );
  // The order's daily BOMs — what the probe answers for it — and another
  // order's, which nothing touches.
  const withDailyBoms = () => {
    const own = [
      bomRepository.seed(dailyBom('ORD-5001', 'TRK-1')),
      bomRepository.seed(dailyBom('ORD-5001', 'TRK-2')),
    ];
    const other = bomRepository.seed(dailyBom('ORD-6001', 'TRK-3'));
    probe.given({ type: 'order', id: order.id.asString() }, [
      { kind: 'daily-bom', name: 'ORD-5001' },
      { kind: 'daily-bom', name: 'ORD-5001' },
    ]);
    return { own, other };
  };
  return { sut, orderRepository, bomRepository, order, withDailyBoms };
}

describe('DeleteOrderHandler', () => {
  it.each([Role.Management, Role.SystemAdmin])(
    'deletes an order without daily BOMs (%s)',
    async (role) => {
      const { sut, orderRepository, order } = makeSut();

      await sut.execute(new DeleteOrderCommand(order.id, role));

      expect(await orderRepository.find(order.id)).toBeNull();
      expect(orderRepository.releasedEvents).toEqual([
        expect.any(OrderDeleted),
      ]);
    },
  );

  it('refuses Management the delete of an order with daily BOMs, deleting nothing', async () => {
    const { sut, orderRepository, bomRepository, order, withDailyBoms } =
      makeSut();
    withDailyBoms();

    await expect(
      sut.execute(new DeleteOrderCommand(order.id, Role.Management)),
    ).rejects.toBeInstanceOf(RecordHasDependents);
    expect(await orderRepository.find(order.id)).not.toBeNull();
    expect(await bomRepository.list()).toHaveLength(3);
  });

  it('deletes, for the System Admin, an order with daily BOMs together with every one of them', async () => {
    const { sut, orderRepository, bomRepository, order, withDailyBoms } =
      makeSut();
    const { other } = withDailyBoms();

    await sut.execute(new DeleteOrderCommand(order.id, Role.SystemAdmin));

    expect(await orderRepository.find(order.id)).toBeNull();
    expect(await bomRepository.list()).toEqual([other]);
  });

  it('refuses an unknown order', async () => {
    const { sut } = makeSut();

    await expect(
      sut.execute(new DeleteOrderCommand(Identity.new(), Role.SystemAdmin)),
    ).rejects.toBeInstanceOf(EntityNotFound);
  });
});
