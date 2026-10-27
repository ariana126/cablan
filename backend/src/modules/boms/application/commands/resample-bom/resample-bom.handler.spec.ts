import { BomComponentInput } from '@boms/application/commands/bom-component.input';
import { BomMustHaveAtLeastOneComponent } from '@boms/application/exceptions';
import { BomCompositionFactory } from '@boms/application/service/bom-composition.factory';
import { InMemoryBomRepository } from '@boms/application/support/in-memory-bom-repository';
import { StubQueryBus } from '@boms/application/support/stub-query-bus';
import { Bom } from '@boms/domain/bom.aggregate';
import { BomNotResamplable } from '@boms/domain/exceptions/bom-not-resamplable.exception';
import { ApprovalStatus } from '@boms/domain/value/approval-status';
import { BomComponentLine } from '@boms/domain/value/bom-component-line.vo';
import { BomMaterialLine } from '@boms/domain/value/bom-material-line.vo';
import { OrderNumber } from '@boms/domain/value/order-number.vo';
import { TrackingNumber } from '@boms/domain/value/tracking-number.vo';
import { Weight } from '@boms/domain/value/weight.vo';
import { EntityNotFound, Identity } from '@framework/domain';
import { GetManufacturingInstructionByMiCodeQuery } from '@manufacturing-instructions/application/queries/get-manufacturing-instruction-by-mi-code/get-manufacturing-instruction-by-mi-code.query';
import { ManufacturingInstructionReadModel } from '@manufacturing-instructions/application/queries/list-manufacturing-instructions/manufacturing-instruction.read-model';
import { QueryBus } from '@nestjs/cqrs';

import { ResampleBomCommand } from './resample-bom.command';
import { ResampleBomHandler } from './resample-bom.handler';

const STANDARD_BOM_ID = Identity.new().asString();

function standardBom(): ManufacturingInstructionReadModel {
  return new ManufacturingInstructionReadModel(
    STANDARD_BOM_ID,
    '0001',
    'Legrand',
    305,
    true,
    undefined,
    'product-1',
    'Product 1',
    [
      {
        id: 'component-1',
        name: 'مغزی',
        materials: [{ id: 'material-1', name: 'مس', weight: 150 }],
      },
    ],
  );
}

function makeSut() {
  const queryBus = new StubQueryBus();
  queryBus.respondTo(
    GetManufacturingInstructionByMiCodeQuery.name,
    standardBom(),
  );
  const bomRepository = new InMemoryBomRepository();
  const sut = new ResampleBomHandler(
    bomRepository,
    new BomCompositionFactory(queryBus as unknown as QueryBus),
  );
  return { sut, bomRepository, queryBus };
}

function seedBom(
  bomRepository: InMemoryBomRepository,
  {
    trackingNumber = 'TRK-6002',
    status = ApprovalStatus.Rejected,
    registeredAt = undefined as Date | undefined,
  } = {},
): Bom {
  const bom = Bom.register(
    Identity.fromString(STANDARD_BOM_ID),
    '0001',
    'Legrand',
    'Product 1',
    305,
    OrderNumber.fromString('ORD-5002'),
    TrackingNumber.fromString(trackingNumber),
    'نمونه اول',
    'نیکروش',
    [
      BomComponentLine.of(Identity.fromString('component-1'), 'مغزی', [
        BomMaterialLine.of(
          Identity.fromString('material-1'),
          'مس',
          Weight.ofGrams(170),
        ),
      ]),
    ],
  );
  if (status === ApprovalStatus.Approved) {
    bom.approve('مصطفی');
  }
  if (status === ApprovalStatus.Rejected) {
    bom.reject('مصطفی', 'وزن مس خارج از محدوده است');
  }
  return bomRepository.seed(bom, registeredAt);
}

function resample(
  source: Bom,
  components: BomComponentInput[] = [
    {
      componentId: 'component-1',
      materials: [{ materialId: 'material-1', weight: 152 }],
    },
  ],
): ResampleBomCommand {
  return new ResampleBomCommand(source.id, components, undefined, 'یاشار');
}

describe('ResampleBomHandler', () => {
  it('registers a new pending daily BOM with the rejected one’s order number, tracking number and MI code, and the new weights', async () => {
    const { sut, bomRepository } = makeSut();
    const source = seedBom(bomRepository);

    const id = await sut.execute(
      new ResampleBomCommand(
        source.id,
        [
          {
            componentId: 'component-1',
            materials: [{ materialId: 'material-1', weight: 152 }],
          },
        ],
        'نمونه دوم',
        'یاشار',
      ),
    );

    const resampled = await bomRepository.get(id);
    expect(resampled.id.equals(source.id)).toBe(false);
    expect(resampled.orderNumber().asString()).toBe('ORD-5002');
    expect(resampled.trackingNumber().asString()).toBe('TRK-6002');
    expect(resampled.standardBomMiCode()).toBe('0001');
    expect(resampled.standardBomId().asString()).toBe(STANDARD_BOM_ID);
    expect(resampled.description()).toBe('نمونه دوم');
    expect(resampled.registeredBy()).toBe('یاشار');
    expect(resampled.approvalStatus()).toBe(ApprovalStatus.Pending);
    expect(resampled.components()).toEqual([
      BomComponentLine.of(Identity.fromString('component-1'), 'مغزی', [
        BomMaterialLine.of(
          Identity.fromString('material-1'),
          'مس',
          Weight.ofGrams(152),
        ),
      ]),
    ]);
  });

  it('clones the composition from the rejected daily BOM’s standard BOM', async () => {
    const { sut, bomRepository, queryBus } = makeSut();
    const source = seedBom(bomRepository);

    await sut.execute(resample(source));

    expect(queryBus.executedQueries).toEqual([
      new GetManufacturingInstructionByMiCodeQuery('0001'),
    ]);
  });

  it('leaves the rejected daily BOM as it was', async () => {
    const { sut, bomRepository } = makeSut();
    const source = seedBom(bomRepository);

    await sut.execute(resample(source));

    const unchanged = await bomRepository.get(source.id);
    expect(unchanged.approvalStatus()).toBe(ApprovalStatus.Rejected);
    expect(unchanged.managementNote()).toBe('وزن مس خارج از محدوده است');
    expect(bomRepository.timesSaved(source.id)).toBe(0);
  });

  it('re-samples a rejected re-sample again, since it is now the latest of its tracking number', async () => {
    const { sut, bomRepository } = makeSut();
    const first = seedBom(bomRepository);
    const latest = seedBom(bomRepository);

    const id = await sut.execute(resample(latest));

    const registered = await bomRepository.list();
    expect(registered.map((bom) => bom.id)).toEqual([first.id, latest.id, id]);
  });

  it.each([ApprovalStatus.Approved, ApprovalStatus.Pending])(
    'refuses to re-sample a daily BOM that is %s, registering nothing',
    async (status) => {
      const { sut, bomRepository } = makeSut();
      const source = seedBom(bomRepository, { status });

      await expect(sut.execute(resample(source))).rejects.toBeInstanceOf(
        BomNotResamplable,
      );
      expect(await bomRepository.list()).toHaveLength(1);
    },
  );

  it('refuses to re-sample a rejected daily BOM once another was registered after it for the same tracking number', async () => {
    const { sut, bomRepository } = makeSut();
    const source = seedBom(bomRepository);
    seedBom(bomRepository, { status: ApprovalStatus.Pending });

    await expect(sut.execute(resample(source))).rejects.toBeInstanceOf(
      BomNotResamplable,
    );
    expect(await bomRepository.list()).toHaveLength(2);
  });

  it('re-samples a rejected daily BOM when the other one of its tracking number was registered earlier, whatever order they were stored in', async () => {
    const { sut, bomRepository } = makeSut();
    const source = seedBom(bomRepository, {
      registeredAt: new Date('2026-10-27T10:00:00.000Z'),
    });
    seedBom(bomRepository, {
      status: ApprovalStatus.Pending,
      registeredAt: new Date('2026-10-27T09:00:00.000Z'),
    });

    await sut.execute(resample(source));

    expect(await bomRepository.list()).toHaveLength(3);
  });

  it('re-samples a rejected daily BOM when only other tracking numbers were registered after it', async () => {
    const { sut, bomRepository } = makeSut();
    const source = seedBom(bomRepository);
    seedBom(bomRepository, { trackingNumber: 'TRK-9999' });

    await sut.execute(resample(source));

    expect(await bomRepository.list()).toHaveLength(3);
  });

  it('refuses a re-sample with no components, as a registration does', async () => {
    const { sut, bomRepository } = makeSut();
    const source = seedBom(bomRepository);

    await expect(sut.execute(resample(source, []))).rejects.toBeInstanceOf(
      BomMustHaveAtLeastOneComponent,
    );
  });

  it('refuses to re-sample a daily BOM that does not exist', async () => {
    const { sut } = makeSut();

    await expect(
      sut.execute(
        new ResampleBomCommand(Identity.new(), [], undefined, 'یاشار'),
      ),
    ).rejects.toBeInstanceOf(EntityNotFound);
  });
});
