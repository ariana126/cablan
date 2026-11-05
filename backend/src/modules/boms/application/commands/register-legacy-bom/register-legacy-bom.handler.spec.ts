import { BomStandardBomNotFound } from '@boms/application/exceptions';
import { BomCompositionFactory } from '@boms/application/service/bom-composition.factory';
import { InMemoryBomRepository } from '@boms/application/support/in-memory-bom-repository';
import { StubQueryBus } from '@boms/application/support/stub-query-bus';
import { stubStandardBoms } from '@boms/application/support/stub-standard-boms';
import { OrderNumber } from '@boms/domain/value/order-number.vo';
import { TrackingNumber } from '@boms/domain/value/tracking-number.vo';
import { Identity } from '@framework/domain';
import { QueryBus } from '@nestjs/cqrs';

import { RegisterLegacyBomCommand } from './register-legacy-bom.command';
import { RegisterLegacyBomHandler } from './register-legacy-bom.handler';

function makeSut() {
  const queryBus = new StubQueryBus();
  stubStandardBoms(queryBus, [
    {
      id: 'standard-bom-0001',
      miCode: '0001',
      productId: 'product-1',
      productName: 'Product 1',
      components: [
        {
          id: 'component-1',
          name: 'Bolt',
          materials: [{ id: 'material-1', name: 'Steel Rod', weight: 150 }],
        },
      ],
    },
  ]);
  const bomRepository = new InMemoryBomRepository();
  const sut = new RegisterLegacyBomHandler(
    bomRepository,
    new BomCompositionFactory(queryBus as unknown as QueryBus),
  );
  return { sut, bomRepository };
}

function legacyRegistration(miCode: string): RegisterLegacyBomCommand {
  return new RegisterLegacyBomCommand(
    miCode,
    OrderNumber.fromString('ORD-5258'),
    TrackingNumber.fromString('TRK-3001'),
    undefined,
    [
      {
        componentId: 'component-1',
        materials: [{ materialId: 'material-1', weight: 3 }],
      },
    ],
    'نیکروش',
  );
}

// A daily BOM as registered before orders existed (issue #101): no order is
// defined for its order number, which only the test stack can still set up.
describe('RegisterLegacyBomHandler', () => {
  it('registers a daily BOM for an order number no order has', async () => {
    const { sut, bomRepository } = makeSut();

    const id = await sut.execute(legacyRegistration('۰۰۰۱'));

    const saved = await bomRepository.get(Identity.fromString(id));
    expect(saved.orderNumber().asString()).toBe('ORD-5258');
    expect(saved.standardBomMiCode()).toBe('0001');
    expect(saved.standardBomId().asString()).toBe('standard-bom-0001');
    expect(saved.registeredBy()).toBe('نیکروش');
  });

  it('still needs a standard BOM for its MI code', async () => {
    const { sut } = makeSut();

    await expect(
      sut.execute(legacyRegistration('9999')),
    ).rejects.toBeInstanceOf(BomStandardBomNotFound);
  });
});
