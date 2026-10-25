import { BomMustHaveAtLeastOneComponent } from '@boms/application/exceptions';
import { BomCompositionFactory } from '@boms/application/service/bom-composition.factory';
import { InMemoryBomRepository } from '@boms/application/support/in-memory-bom-repository';
import { StubQueryBus } from '@boms/application/support/stub-query-bus';
import { Bom } from '@boms/domain/bom.aggregate';
import { ApprovalStatus } from '@boms/domain/value/approval-status';
import { BomComponentLine } from '@boms/domain/value/bom-component-line.vo';
import { BomMaterialLine } from '@boms/domain/value/bom-material-line.vo';
import { OrderNumber } from '@boms/domain/value/order-number.vo';
import { TrackingNumber } from '@boms/domain/value/tracking-number.vo';
import { Weight } from '@boms/domain/value/weight.vo';
import { EntityNotFound, Identity, Role } from '@framework/domain';
import { GetManufacturingInstructionByMiCodeQuery } from '@manufacturing-instructions/application/queries/get-manufacturing-instruction-by-mi-code/get-manufacturing-instruction-by-mi-code.query';
import { ManufacturingInstructionReadModel } from '@manufacturing-instructions/application/queries/list-manufacturing-instructions/manufacturing-instruction.read-model';
import { QueryBus } from '@nestjs/cqrs';

import { EditBomCommand } from './edit-bom.command';
import { EditBomHandler } from './edit-bom.handler';

function standardBomReadModel(): ManufacturingInstructionReadModel {
  return new ManufacturingInstructionReadModel(
    Identity.new().asString(),
    '1234',
    'Legrand',
    305,
    true,
    undefined,
    'product-1',
    'Product 1',
    [
      {
        id: 'component-1',
        name: 'Bolt',
        materials: [{ id: 'material-1', name: 'Steel Rod', weight: 150 }],
      },
      {
        id: 'component-2',
        name: 'Nut',
        materials: [{ id: 'material-2', name: 'Copper Wire', weight: 100 }],
      },
    ],
  );
}

function makeSut() {
  const queryBus = new StubQueryBus();
  queryBus.respondTo(
    GetManufacturingInstructionByMiCodeQuery.name,
    standardBomReadModel(),
  );
  const bomRepository = new InMemoryBomRepository();
  const compositionFactory = new BomCompositionFactory(
    queryBus as unknown as QueryBus,
  );
  const sut = new EditBomHandler(bomRepository, compositionFactory);
  return { sut, bomRepository };
}

function seedBom(bomRepository: InMemoryBomRepository): Bom {
  return bomRepository.seed(
    Bom.register(
      Identity.new(),
      '1234',
      'Legrand',
      'Product 1',
      305,
      OrderNumber.fromString('SO-1234'),
      TrackingNumber.fromString('TN-5678'),
      'Original description',
      'Sina',
      [
        BomComponentLine.of(Identity.new(), 'Bolt', [
          BomMaterialLine.of(Identity.new(), 'Steel Rod', Weight.ofGrams(150)),
        ]),
      ],
    ),
  );
}

describe('EditBomHandler', () => {
  it('edits a BOM’s scalar fields, leaving its components untouched', async () => {
    const { sut, bomRepository } = makeSut();
    const bom = seedBom(bomRepository);
    const originalComponents = bom.components();

    await sut.execute(
      new EditBomCommand(
        bom.id,
        Role.QcInspector,
        OrderNumber.fromString('SO-9999'),
        TrackingNumber.fromString('TN-0000'),
        'Updated description',
      ),
    );

    const saved = await bomRepository.get(bom.id);
    expect(saved.orderNumber().asString()).toBe('SO-9999');
    expect(saved.trackingNumber().asString()).toBe('TN-0000');
    expect(saved.description()).toBe('Updated description');
    expect(saved.components()).toEqual(originalComponents);
    expect(saved.standardBomMiCode()).toBe('1234');
    expect(saved.brand()).toBe('Legrand');
    expect(saved.productName()).toBe('Product 1');
    expect(saved.standardLength()).toBe(305);
    expect(saved.registeredBy()).toBe('Sina');
  });

  it('replaces a BOM’s composition wholesale, leaving its scalar fields untouched', async () => {
    const { sut, bomRepository } = makeSut();
    const bom = seedBom(bomRepository);

    await sut.execute(
      new EditBomCommand(
        bom.id,
        Role.QcInspector,
        undefined,
        undefined,
        undefined,
        [
          {
            componentId: 'component-2',
            materials: [{ materialId: 'material-2', weight: 200 }],
          },
        ],
        '1234',
      ),
    );

    const saved = await bomRepository.get(bom.id);
    expect(saved.orderNumber().asString()).toBe('SO-1234');
    expect(saved.components()).toHaveLength(1);
    expect(saved.components()[0].componentId().asString()).toBe('component-2');
    expect(saved.components()[0].name()).toBe('Nut');
    expect(saved.components()[0].materials()[0].weight().asGrams()).toBe(200);
  });

  it('rejects editing a BOM to have no components', async () => {
    const { sut, bomRepository } = makeSut();
    const bom = seedBom(bomRepository);

    await expect(
      sut.execute(
        new EditBomCommand(
          bom.id,
          Role.QcInspector,
          undefined,
          undefined,
          undefined,
          [],
          '1234',
        ),
      ),
    ).rejects.toBeInstanceOf(BomMustHaveAtLeastOneComponent);
  });

  it('rejects editing a BOM that does not exist', async () => {
    const { sut } = makeSut();

    await expect(
      sut.execute(new EditBomCommand(Identity.new(), Role.QcInspector)),
    ).rejects.toBeInstanceOf(EntityNotFound);
  });

  it("rejects a componentId that isn't part of the referenced standard BOM's current composition", async () => {
    const { sut, bomRepository } = makeSut();
    const bom = seedBom(bomRepository);

    await expect(
      sut.execute(
        new EditBomCommand(
          bom.id,
          Role.QcInspector,
          undefined,
          undefined,
          undefined,
          [
            {
              componentId: 'unknown-component',
              materials: [{ materialId: 'material-1', weight: 150 }],
            },
          ],
          '1234',
        ),
      ),
    ).rejects.toThrow();
  });

  it('rejects replacing a BOM’s composition without a standardBomMiCode to reclone from', async () => {
    const { sut, bomRepository } = makeSut();
    const bom = seedBom(bomRepository);

    await expect(
      sut.execute(
        new EditBomCommand(
          bom.id,
          Role.QcInspector,
          undefined,
          undefined,
          undefined,
          [
            {
              componentId: 'component-2',
              materials: [{ materialId: 'material-2', weight: 200 }],
            },
          ],
        ),
      ),
    ).rejects.toThrow(
      'standardBomMiCode is required when components is provided',
    );
  });

  it('an edit that changes an approved BOM sends it back to pending', async () => {
    const { sut, bomRepository } = makeSut();
    const bom = seedBom(bomRepository);
    bom.approve('مصطفی');

    await sut.execute(
      new EditBomCommand(
        bom.id,
        Role.QcInspector,
        undefined,
        TrackingNumber.fromString('TN-0000'),
      ),
    );

    const saved = await bomRepository.get(bom.id);
    expect(saved.approvalStatus()).toBe(ApprovalStatus.Pending);
    expect(saved.reviewedBy()).toBeNull();
  });

  it('a rejected edit leaves an approved BOM approved by the same reviewer', async () => {
    const { sut, bomRepository } = makeSut();
    const bom = seedBom(bomRepository);
    bom.approve('مصطفی');

    await expect(
      sut.execute(
        new EditBomCommand(
          bom.id,
          Role.QcInspector,
          OrderNumber.fromString('SO-9999'),
          undefined,
          undefined,
          [],
          '1234',
        ),
      ),
    ).rejects.toBeInstanceOf(BomMustHaveAtLeastOneComponent);
    const saved = await bomRepository.get(bom.id);
    expect(saved.approvalStatus()).toBe(ApprovalStatus.Approved);
    expect(saved.reviewedBy()).toBe('مصطفی');
  });

  it.each([[Role.Management], [Role.SystemAdmin]])(
    'an edit by a user with the %p role, who may review, is noted when the BOM is approved',
    async (role) => {
      const { sut, bomRepository } = makeSut();
      const bom = seedBom(bomRepository);
      await sut.execute(
        new EditBomCommand(
          bom.id,
          role,
          undefined,
          TrackingNumber.fromString('TN-0000'),
        ),
      );
      const saved = await bomRepository.get(bom.id);

      saved.approve('مصطفی');

      expect(saved.managementNote()).toBe(
        'شماره ردیابی از TN-5678 به TN-0000 تغییر کرد',
      );
    },
  );

  it.each([[Role.QcInspector], [null]])(
    'an edit by a user with the %p role, who may not review, is not noted when the BOM is approved',
    async (role) => {
      const { sut, bomRepository } = makeSut();
      const bom = seedBom(bomRepository);
      await sut.execute(
        new EditBomCommand(
          bom.id,
          role,
          undefined,
          TrackingNumber.fromString('TN-0000'),
        ),
      );
      const saved = await bomRepository.get(bom.id);

      saved.approve('مصطفی');

      expect(saved.managementNote()).toBeNull();
    },
  );
});
