import {
  BomComponentMustHaveAtLeastOneMaterial,
  BomMustHaveAtLeastOneComponent,
  BomOrderNotDefined,
  BomStandardBomNotFound,
} from '@boms/application/exceptions';
import { BomCompositionFactory } from '@boms/application/service/bom-composition.factory';
import { InMemoryBomRepository } from '@boms/application/support/in-memory-bom-repository';
import { InMemoryOrderRepository } from '@boms/application/support/in-memory-order-repository';
import { StubQueryBus } from '@boms/application/support/stub-query-bus';
import { stubStandardBoms } from '@boms/application/support/stub-standard-boms';
import { BomMiCodeNotInOrder } from '@boms/domain/exceptions/bom-mi-code-not-in-order.exception';
import { BomMiCodeRequired } from '@boms/domain/exceptions/bom-mi-code-required.exception';
import { Order } from '@boms/domain/order.aggregate';
import { OrderMiCode } from '@boms/domain/value/order-mi-code.vo';
import { OrderNumber } from '@boms/domain/value/order-number.vo';
import { TrackingNumber } from '@boms/domain/value/tracking-number.vo';
import { EntityNotFound, Identity } from '@framework/domain';
import { GetManufacturingInstructionByMiCodeQuery } from '@manufacturing-instructions/application/queries/get-manufacturing-instruction-by-mi-code/get-manufacturing-instruction-by-mi-code.query';
import { QueryBus } from '@nestjs/cqrs';

import { RegisterBomCommand } from './register-bom.command';
import { RegisterBomHandler } from './register-bom.handler';

const COMPONENTS = [
  {
    componentId: 'component-1',
    materials: [{ materialId: 'material-1', weight: 150 }],
  },
];

function standardBom(miCode: string, standardBomId = `standard-bom-${miCode}`) {
  return {
    id: standardBomId,
    miCode,
    productId: 'product-1',
    productName: 'Product 1',
    brand: 'Legrand',
    standardLength: 305,
    components: [
      {
        id: 'component-1',
        name: 'Bolt',
        materials: [{ id: 'material-1', name: 'Steel Rod', weight: 150 }],
      },
    ],
  };
}

function assigned(miCode: string): OrderMiCode {
  return OrderMiCode.of(
    Identity.fromString(`standard-bom-${miCode}`),
    miCode,
    Identity.fromString('product-1'),
    'Product 1',
  );
}

function makeSut() {
  const queryBus = new StubQueryBus();
  stubStandardBoms(queryBus, [
    standardBom('1234'),
    standardBom('1235'),
    standardBom('1236'),
  ]);
  const bomRepository = new InMemoryBomRepository();
  const orderRepository = new InMemoryOrderRepository();
  // SO-1234 assigns one MI code, SO-2000 two.
  orderRepository.seed(
    Order.define(OrderNumber.fromString('SO-1234'), [assigned('1234')]),
  );
  orderRepository.seed(
    Order.define(OrderNumber.fromString('SO-2000'), [
      assigned('1234'),
      assigned('1235'),
    ]),
  );
  const compositionFactory = new BomCompositionFactory(
    queryBus as unknown as QueryBus,
  );
  const sut = new RegisterBomHandler(
    bomRepository,
    orderRepository,
    compositionFactory,
  );
  return { sut, bomRepository, queryBus };
}

function registration(
  standardBomMiCode: string | undefined,
  orderNumber = 'SO-1234',
  components = COMPONENTS,
): RegisterBomCommand {
  return new RegisterBomCommand(
    standardBomMiCode,
    OrderNumber.fromString(orderNumber),
    TrackingNumber.fromString('TN-5678'),
    undefined,
    components,
    'Sina',
  );
}

describe('RegisterBomHandler', () => {
  it('registers a new BOM, cloning the referenced composition and attaching the given weight', async () => {
    const { sut, bomRepository } = makeSut();

    const result = await sut.execute(registration('1234'));

    expect(result.standardBomId).toBe('standard-bom-1234');
    expect(result.orderNumber).toBe('SO-1234');
    expect(result.trackingNumber).toBe('TN-5678');
    expect(result.components).toEqual([
      {
        id: 'component-1',
        name: 'Bolt',
        materials: [{ id: 'material-1', name: 'Steel Rod', weight: 150 }],
      },
    ]);
    const saved = await bomRepository.get(Identity.fromString(result.id));
    expect(saved.orderNumber().asString()).toBe('SO-1234');
    expect(saved.standardBomMiCode()).toBe('1234');
    expect(saved.brand()).toBe('Legrand');
    expect(saved.productName()).toBe('Product 1');
    expect(saved.standardLength()).toBe(305);
    expect(saved.registeredBy()).toBe('Sina');
  });

  it('rejects registering a BOM with no components', async () => {
    const { sut } = makeSut();

    await expect(
      sut.execute(registration('1234', 'SO-1234', [])),
    ).rejects.toBeInstanceOf(BomMustHaveAtLeastOneComponent);
  });

  it('rejects registering a BOM whose component has no materials', async () => {
    const { sut } = makeSut();

    await expect(
      sut.execute(
        registration('1234', 'SO-1234', [
          { componentId: 'component-1', materials: [] },
        ]),
      ),
    ).rejects.toBeInstanceOf(BomComponentMustHaveAtLeastOneMaterial);
  });

  it("rejects registering a BOM against an order's MI code whose standard BOM no longer resolves", async () => {
    const { sut, queryBus } = makeSut();
    queryBus.rejectWith(
      GetManufacturingInstructionByMiCodeQuery.name,
      EntityNotFound.withId(Identity.new()),
    );

    await expect(sut.execute(registration('1234'))).rejects.toBeInstanceOf(
      BomStandardBomNotFound,
    );
  });

  describe('only for a defined order, with one of its MI codes (issue #101)', () => {
    it('takes the MI code of an order that has one when none is chosen', async () => {
      const { sut, bomRepository } = makeSut();

      const result = await sut.execute(registration());

      const saved = await bomRepository.get(Identity.fromString(result.id));
      expect(saved.standardBomMiCode()).toBe('1234');
      expect(saved.standardBomId().asString()).toBe('standard-bom-1234');
    });

    it('registers with the chosen one of several MI codes, Persian digits too', async () => {
      const { sut, bomRepository } = makeSut();

      const result = await sut.execute(registration('۱۲۳۵', 'SO-2000'));

      const saved = await bomRepository.get(Identity.fromString(result.id));
      expect(saved.standardBomMiCode()).toBe('1235');
      expect(saved.standardBomId().asString()).toBe('standard-bom-1235');
    });

    it('refuses no MI code chosen for an order with several', async () => {
      const { sut, bomRepository } = makeSut();

      await expect(
        sut.execute(registration(undefined, 'SO-2000')),
      ).rejects.toBeInstanceOf(BomMiCodeRequired);
      expect(await bomRepository.list()).toEqual([]);
    });

    it('refuses an MI code the order does not have, though a standard BOM does', async () => {
      const { sut, bomRepository } = makeSut();

      await expect(sut.execute(registration('1236'))).rejects.toBeInstanceOf(
        BomMiCodeNotInOrder,
      );
      expect(await bomRepository.list()).toEqual([]);
    });

    it('refuses an order number no order has', async () => {
      const { sut, bomRepository } = makeSut();

      await expect(
        sut.execute(registration('1234', 'ORD-6001')),
      ).rejects.toBeInstanceOf(BomOrderNotDefined);
      expect(await bomRepository.list()).toEqual([]);
    });

    it('finds the order typed with Persian digits, storing English ones', async () => {
      const { sut, bomRepository } = makeSut();

      const result = await sut.execute(registration(undefined, 'SO-۱۲۳۴'));

      const saved = await bomRepository.get(Identity.fromString(result.id));
      expect(saved.orderNumber().asString()).toBe('SO-1234');
    });
  });
});
