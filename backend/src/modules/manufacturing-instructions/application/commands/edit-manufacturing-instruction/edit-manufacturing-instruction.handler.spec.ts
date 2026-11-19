import {
  RecordDependencies,
  RecordHasDependents,
} from '@framework/application';
import { ImmediateUnitOfWork } from '@framework/application/support/immediate-unit-of-work';
import { StubCorrectionPropagator } from '@framework/application/support/stub-correction-propagator';
import { StubDependentsProbe } from '@framework/application/support/stub-dependents-probe';
import { EntityNotFound, Identity, Role } from '@framework/domain';
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
  const probe = new StubDependentsProbe();
  const propagator = new StubCorrectionPropagator();
  const sut = new EditManufacturingInstructionHandler(
    manufacturingInstructionRepository,
    compositionFactory,
    new RecordDependencies([probe], [propagator]),
    new ImmediateUnitOfWork(),
  );
  return { sut, manufacturingInstructionRepository, probe, propagator };
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

// A standard BOM cloned from `productReadModel()`'s composition, so an edit
// can resend its own (component, material) pairs.
function seedClonedManufacturingInstruction(
  manufacturingInstructionRepository: InMemoryManufacturingInstructionRepository,
): ManufacturingInstruction {
  return manufacturingInstructionRepository.seed(
    ManufacturingInstruction.register(
      MiCode.fromString('MI-100'),
      Brand.fromString('LEGRAND'),
      StandardLength.of(500),
      true,
      'Original description',
      Identity.fromString('product-1'),
      'Widget',
      [
        ManufacturingInstructionComponentLine.of(
          Identity.fromString('component-1'),
          'Bolt',
          [
            ManufacturingInstructionMaterialLine.of(
              Identity.fromString('material-1'),
              'Steel Rod',
              Weight.ofGrams(100),
            ),
          ],
        ),
        ManufacturingInstructionComponentLine.of(
          Identity.fromString('component-2'),
          'Nut',
          [
            ManufacturingInstructionMaterialLine.of(
              Identity.fromString('material-2'),
              'Copper Wire',
              Weight.ofGrams(20),
            ),
          ],
        ),
      ],
    ),
  );
}

function inUse(
  probe: StubDependentsProbe,
  manufacturingInstruction: ManufacturingInstruction,
): void {
  probe.given(
    { type: 'StandardBom', id: manufacturingInstruction.id.asString() },
    [{ kind: 'daily-bom', name: 'ORD-5002' }],
  );
}

describe('EditManufacturingInstructionHandler', () => {
  describe("the System Admin's correction of a standard BOM in use (issue #126)", () => {
    it('saves its weights, brand, standard length, description and active flag', async () => {
      const { sut, manufacturingInstructionRepository, probe } = makeSut();
      const manufacturingInstruction = seedClonedManufacturingInstruction(
        manufacturingInstructionRepository,
      );
      inUse(probe, manufacturingInstruction);

      await sut.execute(
        new EditManufacturingInstructionCommand(
          manufacturingInstruction.id,
          Role.SystemAdmin,
          MiCode.fromString('MI-100'),
          Brand.fromString('Schneider'),
          StandardLength.of(480),
          'Corrected description',
          false,
          [
            {
              componentId: 'component-2',
              materials: [{ materialId: 'material-2', weight: 25 }],
            },
            {
              componentId: 'component-1',
              materials: [{ materialId: 'material-1', weight: 105 }],
            },
          ],
        ),
      );

      const saved = await manufacturingInstructionRepository.get(
        manufacturingInstruction.id,
      );
      expect(saved.miCode().asString()).toBe('MI-100');
      expect(saved.brand().asString()).toBe('Schneider');
      expect(saved.standardLength().asNumber()).toBe(480);
      expect(saved.description()).toBe('Corrected description');
      expect(saved.active()).toBe(false);
      expect(
        saved
          .components()
          .map((component) => [
            component.componentId().asString(),
            component.materials()[0].weight().asGrams(),
          ]),
      ).toEqual([
        ['component-2', 25],
        ['component-1', 105],
      ]);
    });

    it('carries the corrected brand and standard length into the records holding them', async () => {
      const { sut, manufacturingInstructionRepository, probe, propagator } =
        makeSut();
      const manufacturingInstruction = seedClonedManufacturingInstruction(
        manufacturingInstructionRepository,
      );
      inUse(probe, manufacturingInstruction);

      await sut.execute(
        new EditManufacturingInstructionCommand(
          manufacturingInstruction.id,
          Role.SystemAdmin,
          undefined,
          Brand.fromString('Schneider'),
          StandardLength.of(480),
        ),
      );

      expect(propagator.propagated).toEqual([
        {
          reference: {
            type: 'StandardBom',
            id: manufacturingInstruction.id.asString(),
          },
          correction: { brand: 'Schneider', standardLength: 480 },
        },
      ]);
    });

    it('carries nothing when only its weights change', async () => {
      const { sut, manufacturingInstructionRepository, probe, propagator } =
        makeSut();
      const manufacturingInstruction = seedClonedManufacturingInstruction(
        manufacturingInstructionRepository,
      );
      inUse(probe, manufacturingInstruction);

      await sut.execute(
        new EditManufacturingInstructionCommand(
          manufacturingInstruction.id,
          Role.SystemAdmin,
          undefined,
          undefined,
          undefined,
          undefined,
          undefined,
          [
            {
              componentId: 'component-1',
              materials: [{ materialId: 'material-1', weight: 105 }],
            },
            {
              componentId: 'component-2',
              materials: [{ materialId: 'material-2', weight: 20 }],
            },
          ],
        ),
      );

      const saved = await manufacturingInstructionRepository.get(
        manufacturingInstruction.id,
      );
      expect(saved.components()[0].materials()[0].weight().asGrams()).toBe(105);
      expect(propagator.propagated).toEqual([]);
    });

    it.each([
      ['its MI code', { miCode: 'MI-200' }],
      [
        'a material added to a component',
        {
          components: [
            {
              componentId: 'component-1',
              materials: [
                { materialId: 'material-1', weight: 100 },
                { materialId: 'material-2', weight: 5 },
              ],
            },
            {
              componentId: 'component-2',
              materials: [{ materialId: 'material-2', weight: 20 }],
            },
          ],
        },
      ],
      [
        'a component removed',
        {
          components: [
            {
              componentId: 'component-1',
              materials: [{ materialId: 'material-1', weight: 100 }],
            },
          ],
        },
      ],
    ])(
      'refuses a change of %s, leaving it unchanged and carrying nothing',
      async (
        _label,
        change: {
          miCode?: string;
          components?: {
            componentId: string;
            materials: { materialId: string; weight: number }[];
          }[];
        },
      ) => {
        const { sut, manufacturingInstructionRepository, probe, propagator } =
          makeSut();
        const manufacturingInstruction = seedClonedManufacturingInstruction(
          manufacturingInstructionRepository,
        );
        inUse(probe, manufacturingInstruction);

        await expect(
          sut.execute(
            new EditManufacturingInstructionCommand(
              manufacturingInstruction.id,
              Role.SystemAdmin,
              change.miCode === undefined
                ? undefined
                : MiCode.fromString(change.miCode),
              Brand.fromString('Schneider'),
              undefined,
              undefined,
              undefined,
              change.components,
            ),
          ),
        ).rejects.toEqual(
          RecordHasDependents.of(
            {
              type: 'StandardBom',
              id: manufacturingInstruction.id.asString(),
            },
            [{ kind: 'daily-bom', count: 1, names: ['ORD-5002'] }],
          ),
        );
        const kept = await manufacturingInstructionRepository.get(
          manufacturingInstruction.id,
        );
        expect(kept.miCode().asString()).toBe('MI-100');
        expect(kept.brand().asString()).toBe('LEGRAND');
        expect(kept.components()).toEqual(
          manufacturingInstruction.components(),
        );
        expect(propagator.propagated).toEqual([]);
      },
    );
  });

  it.each([
    [
      'its weights',
      {
        components: [
          {
            componentId: 'component-1',
            materials: [{ materialId: 'material-1', weight: 200 }],
          },
        ],
      },
    ],
    ['its MI code', { miCode: '5678' }],
    ['its brand', { brand: 'Schneider' }],
    ['its active flag', { active: false }],
  ])(
    'refuses editing %s of a standard BOM a daily BOM references, leaving it unchanged',
    async (
      _field,
      change: {
        miCode?: string;
        brand?: string;
        active?: boolean;
        components?: {
          componentId: string;
          materials: { materialId: string; weight: number }[];
        }[];
      },
    ) => {
      const { sut, manufacturingInstructionRepository, probe } = makeSut();
      const manufacturingInstruction = seedManufacturingInstruction(
        manufacturingInstructionRepository,
        '1234',
      );
      probe.given(
        { type: 'StandardBom', id: manufacturingInstruction.id.asString() },
        [{ kind: 'daily-bom', name: 'ORD-1' }],
      );

      await expect(
        sut.execute(
          new EditManufacturingInstructionCommand(
            manufacturingInstruction.id,
            Role.Management,
            change.miCode === undefined
              ? undefined
              : MiCode.fromString(change.miCode),
            change.brand === undefined
              ? undefined
              : Brand.fromString(change.brand),
            undefined,
            undefined,
            change.active,
            change.components,
          ),
        ),
      ).rejects.toBeInstanceOf(RecordHasDependents);
      const kept = await manufacturingInstructionRepository.get(
        manufacturingInstruction.id,
      );
      expect(kept.miCode().asString()).toBe('1234');
      expect(kept.brand().asString()).toBe('Legrand');
      expect(kept.active()).toBe(true);
      expect(kept.components()).toEqual(manufacturingInstruction.components());
    },
  );

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
        Role.Management,
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
        Role.Management,
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
          Role.Management,
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
          Role.Management,
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
          Role.Management,
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
        Role.Management,
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
          Role.Management,
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
