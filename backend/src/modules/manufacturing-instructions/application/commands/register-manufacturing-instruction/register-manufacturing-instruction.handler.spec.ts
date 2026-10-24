import { Identity } from '@framework/domain';
import {
  ManufacturingInstructionComponentMustHaveAtLeastOneMaterial,
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

import { RegisterManufacturingInstructionCommand } from './register-manufacturing-instruction.command';
import { RegisterManufacturingInstructionHandler } from './register-manufacturing-instruction.handler';

function productReadModel(): ProductReadModel {
  return new ProductReadModel('product-1', 'Widget', [
    {
      id: 'component-1',
      name: 'Bolt',
      materials: [{ id: 'material-1', name: 'Steel Rod' }],
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
  const sut = new RegisterManufacturingInstructionHandler(
    manufacturingInstructionRepository,
    compositionFactory,
  );
  return { sut, manufacturingInstructionRepository, queryBus };
}

function standardBomWithMiCode(miCode: string): ManufacturingInstruction {
  return ManufacturingInstruction.register(
    MiCode.fromString(miCode),
    Brand.fromString('Legrand'),
    StandardLength.of(305),
    true,
    undefined,
    Identity.new(),
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
  );
}

function registerCommandWithMiCode(
  miCode: string,
): RegisterManufacturingInstructionCommand {
  return new RegisterManufacturingInstructionCommand(
    Identity.new(),
    MiCode.fromString(miCode),
    Brand.fromString('Legrand'),
    StandardLength.of(305),
    true,
    undefined,
    [
      {
        componentId: 'component-1',
        materials: [{ materialId: 'material-1', weight: 150 }],
      },
    ],
  );
}

describe('RegisterManufacturingInstructionHandler', () => {
  it('registers a new standard BOM, cloning the referenced composition and attaching the given weight', async () => {
    const { sut, manufacturingInstructionRepository } = makeSut();
    const productId = Identity.new();

    const result = await sut.execute(
      new RegisterManufacturingInstructionCommand(
        productId,
        MiCode.fromString('1234'),
        Brand.fromString('Legrand'),
        StandardLength.of(305),
        true,
        undefined,
        [
          {
            componentId: 'component-1',
            materials: [{ materialId: 'material-1', weight: 150 }],
          },
        ],
      ),
    );

    expect(result.miCode).toBe('1234');
    expect(result.brand).toBe('Legrand');
    expect(result.standardLength).toBe(305);
    expect(result.active).toBe(true);
    expect(result.productId).toBe(productId.asString());
    expect(result.productName).toBe('Widget');
    expect(result.components).toEqual([
      {
        id: 'component-1',
        name: 'Bolt',
        materials: [{ id: 'material-1', name: 'Steel Rod', weight: 150 }],
      },
    ]);
    const saved = await manufacturingInstructionRepository.get(
      Identity.fromString(result.id),
    );
    expect(saved.miCode().asString()).toBe('1234');
  });

  it('rejects registering a standard BOM with no components', async () => {
    const { sut } = makeSut();

    await expect(
      sut.execute(
        new RegisterManufacturingInstructionCommand(
          Identity.new(),
          MiCode.fromString('1234'),
          Brand.fromString('Legrand'),
          StandardLength.of(305),
          true,
          undefined,
          [],
        ),
      ),
    ).rejects.toBeInstanceOf(
      ManufacturingInstructionMustHaveAtLeastOneComponent,
    );
  });

  it('rejects registering a standard BOM whose component has no materials', async () => {
    const { sut } = makeSut();

    await expect(
      sut.execute(
        new RegisterManufacturingInstructionCommand(
          Identity.new(),
          MiCode.fromString('1234'),
          Brand.fromString('Legrand'),
          StandardLength.of(305),
          true,
          undefined,
          [{ componentId: 'component-1', materials: [] }],
        ),
      ),
    ).rejects.toBeInstanceOf(
      ManufacturingInstructionComponentMustHaveAtLeastOneMaterial,
    );
  });

  it('rejects registering a standard BOM with an already-used MI code', async () => {
    const { sut, manufacturingInstructionRepository } = makeSut();
    manufacturingInstructionRepository.seed(standardBomWithMiCode('1234'));

    await expect(
      sut.execute(registerCommandWithMiCode('1234')),
    ).rejects.toBeInstanceOf(ManufacturingInstructionMiCodeAlreadyExists);
  });

  it('rejects registering an MI code typed with Persian digits that is already used in English digits', async () => {
    const { sut, manufacturingInstructionRepository } = makeSut();
    manufacturingInstructionRepository.seed(standardBomWithMiCode('1234'));

    await expect(
      sut.execute(registerCommandWithMiCode('۱۲۳۴')),
    ).rejects.toBeInstanceOf(ManufacturingInstructionMiCodeAlreadyExists);
  });
});
