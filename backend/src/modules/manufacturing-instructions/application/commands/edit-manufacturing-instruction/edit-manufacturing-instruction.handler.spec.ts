import { EntityNotFound, Identity } from '@framework/domain';
import {
  ManufacturingInstructionCompositionEntryNotFound,
  ManufacturingInstructionMiCodeAlreadyExists,
  ManufacturingInstructionMustHaveAtLeastOneComponent,
} from '@manufacturing-instructions/application/exceptions';
import { ManufacturingInstructionCompositionFactory } from '@manufacturing-instructions/application/service/manufacturing-instruction-composition.factory';
import { InMemoryManufacturingInstructionRepository } from '@manufacturing-instructions/application/support/in-memory-manufacturing-instruction-repository';
import { StubQueryBus } from '@manufacturing-instructions/application/support/stub-query-bus';
import { ManufacturingInstruction } from '@manufacturing-instructions/domain/manufacturing-instruction.aggregate';
import { Brand } from '@manufacturing-instructions/domain/value/brand.vo';
import { ManufacturingInstructionComponentLine } from '@manufacturing-instructions/domain/value/manufacturing-instruction-component-line.vo';
import { ManufacturingInstructionMaterialLine } from '@manufacturing-instructions/domain/value/manufacturing-instruction-material-line.vo';
import { MiCode } from '@manufacturing-instructions/domain/value/mi-code.vo';
import { StandardLength } from '@manufacturing-instructions/domain/value/standard-length.vo';
import { Weight } from '@manufacturing-instructions/domain/value/weight.vo';
import { QueryBus } from '@nestjs/cqrs';
import { GetProductQuery } from '@products/application/queries/get-product/get-product.query';
import { ProductReadModel } from '@products/application/queries/list-products/product.read-model';

import { EditManufacturingInstructionCommand } from './edit-manufacturing-instruction.command';
import { EditManufacturingInstructionHandler } from './edit-manufacturing-instruction.handler';

function productReadModel(): ProductReadModel {
  return new ProductReadModel('product-1', 'Widget', [
    {
      id: 'component-1',
      name: 'Bolt',
      materials: [{ id: 'material-1', name: 'Steel Rod' }],
    },
    {
      id: 'component-2',
      name: 'Nut',
      materials: [{ id: 'material-2', name: 'Copper Wire' }],
    },
  ]);
}

function makeSut() {
  const queryBus = new StubQueryBus();
  queryBus.respondTo(GetProductQuery.name, productReadModel());
  const manufacturingInstructionRepository =
    new InMemoryManufacturingInstructionRepository();
  const compositionFactory = new ManufacturingInstructionCompositionFactory(
    queryBus as unknown as QueryBus,
  );
  const sut = new EditManufacturingInstructionHandler(
    manufacturingInstructionRepository,
    compositionFactory,
  );
  return { sut, manufacturingInstructionRepository };
}

function seedManufacturingInstruction(
  manufacturingInstructionRepository: InMemoryManufacturingInstructionRepository,
  miCode: string,
  productId: Identity = Identity.new(),
): ManufacturingInstruction {
  return manufacturingInstructionRepository.seed(
    ManufacturingInstruction.register(
      MiCode.fromString(miCode),
      Brand.fromString('Legrand'),
      StandardLength.of(305),
      true,
      'Original description',
      productId,
      'Widget',
      [
        ManufacturingInstructionComponentLine.of(Identity.new(), 'Bolt', [
          ManufacturingInstructionMaterialLine.of(
            Identity.new(),
            'Steel Rod',
            Weight.ofGrams(150),
          ),
        ]),
      ],
    ),
  );
}

describe('EditManufacturingInstructionHandler', () => {
  it('edits a standard BOM’s scalar fields, leaving its components untouched', async () => {
    const { sut, manufacturingInstructionRepository } = makeSut();
    const manufacturingInstruction = seedManufacturingInstruction(
      manufacturingInstructionRepository,
      '1234',
    );
    const originalComponents = manufacturingInstruction.components();

    await sut.execute(
      new EditManufacturingInstructionCommand(
        manufacturingInstruction.id,
        MiCode.fromString('5678'),
        Brand.fromString('Schneider'),
        StandardLength.of(500),
        'Updated description',
        false,
      ),
    );

    const saved = await manufacturingInstructionRepository.get(
      manufacturingInstruction.id,
    );
    expect(saved.miCode().asString()).toBe('5678');
    expect(saved.brand().asString()).toBe('Schneider');
    expect(saved.standardLength().asNumber()).toBe(500);
    expect(saved.description()).toBe('Updated description');
    expect(saved.active()).toBe(false);
    expect(saved.components()).toEqual(originalComponents);
  });

  it('replaces a standard BOM’s composition wholesale, leaving its scalar fields untouched', async () => {
    const { sut, manufacturingInstructionRepository } = makeSut();
    const productId = Identity.new();
    const manufacturingInstruction = seedManufacturingInstruction(
      manufacturingInstructionRepository,
      '1234',
      productId,
    );

    await sut.execute(
      new EditManufacturingInstructionCommand(
        manufacturingInstruction.id,
        undefined,
        undefined,
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
    );

    const saved = await manufacturingInstructionRepository.get(
      manufacturingInstruction.id,
    );
    expect(saved.miCode().asString()).toBe('1234');
    expect(saved.components()).toHaveLength(1);
    expect(saved.components()[0].componentId().asString()).toBe('component-2');
    expect(saved.components()[0].name()).toBe('Nut');
    expect(saved.components()[0].materials()[0].weight().asGrams()).toBe(200);
  });

  it('rejects editing a standard BOM to have no components', async () => {
    const { sut, manufacturingInstructionRepository } = makeSut();
    const manufacturingInstruction = seedManufacturingInstruction(
      manufacturingInstructionRepository,
      '1234',
    );

    await expect(
      sut.execute(
        new EditManufacturingInstructionCommand(
          manufacturingInstruction.id,
          undefined,
          undefined,
          undefined,
          undefined,
          undefined,
          [],
        ),
      ),
    ).rejects.toBeInstanceOf(
      ManufacturingInstructionMustHaveAtLeastOneComponent,
    );
  });

  it('rejects editing a standard BOM that does not exist', async () => {
    const { sut } = makeSut();

    await expect(
      sut.execute(
        new EditManufacturingInstructionCommand(
          Identity.new(),
          MiCode.fromString('1234'),
        ),
      ),
    ).rejects.toBeInstanceOf(EntityNotFound);
  });

  it('rejects editing a standard BOM’s MI code to one already used by another standard BOM', async () => {
    const { sut, manufacturingInstructionRepository } = makeSut();
    seedManufacturingInstruction(manufacturingInstructionRepository, '1234');
    const other = seedManufacturingInstruction(
      manufacturingInstructionRepository,
      '5678',
    );

    await expect(
      sut.execute(
        new EditManufacturingInstructionCommand(
          other.id,
          MiCode.fromString('1234'),
        ),
      ),
    ).rejects.toBeInstanceOf(ManufacturingInstructionMiCodeAlreadyExists);
  });

  it('allows resending a standard BOM’s own current MI code unchanged', async () => {
    const { sut, manufacturingInstructionRepository } = makeSut();
    const manufacturingInstruction = seedManufacturingInstruction(
      manufacturingInstructionRepository,
      '1234',
    );

    await sut.execute(
      new EditManufacturingInstructionCommand(
        manufacturingInstruction.id,
        MiCode.fromString('1234'),
        Brand.fromString('Updated'),
      ),
    );

    const saved = await manufacturingInstructionRepository.get(
      manufacturingInstruction.id,
    );
    expect(saved.miCode().asString()).toBe('1234');
    expect(saved.brand().asString()).toBe('Updated');
  });

  it("rejects a componentId that isn't part of the referenced product's current composition", async () => {
    const { sut, manufacturingInstructionRepository } = makeSut();
    const manufacturingInstruction = seedManufacturingInstruction(
      manufacturingInstructionRepository,
      '1234',
    );

    await expect(
      sut.execute(
        new EditManufacturingInstructionCommand(
          manufacturingInstruction.id,
          undefined,
          undefined,
          undefined,
          undefined,
          undefined,
          [
            {
              componentId: 'unknown-component',
              materials: [{ materialId: 'material-1', weight: 150 }],
            },
          ],
        ),
      ),
    ).rejects.toBeInstanceOf(ManufacturingInstructionCompositionEntryNotFound);
  });
});
