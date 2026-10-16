import { Identity } from '@framework/domain';

import { ManufacturingInstructionDeleted } from './events/manufacturing-instruction-deleted.event';
import { ManufacturingInstructionEdited } from './events/manufacturing-instruction-edited.event';
import { ManufacturingInstructionRegistered } from './events/manufacturing-instruction-registered.event';
import { ManufacturingInstruction } from './manufacturing-instruction.aggregate';
import { Brand } from './value/brand.vo';
import { ManufacturingInstructionComponentLine } from './value/manufacturing-instruction-component-line.vo';
import { ManufacturingInstructionMaterialLine } from './value/manufacturing-instruction-material-line.vo';
import { MiCode } from './value/mi-code.vo';
import { StandardLength } from './value/standard-length.vo';
import { Weight } from './value/weight.vo';

function componentLine(
  componentId: Identity,
  name: string,
  materialId: Identity,
  materialName: string,
): ManufacturingInstructionComponentLine {
  return ManufacturingInstructionComponentLine.of(componentId, name, [
    ManufacturingInstructionMaterialLine.of(
      materialId,
      materialName,
      Weight.ofGrams(150),
    ),
  ]);
}

function registerManufacturingInstruction(
  productId: Identity = Identity.new(),
): ManufacturingInstruction {
  return ManufacturingInstruction.register(
    MiCode.fromString('1234'),
    Brand.fromString('Legrand'),
    StandardLength.of(305),
    true,
    'Standard for network cables',
    productId,
    'Widget',
    [componentLine(Identity.new(), 'Bolt', Identity.new(), 'Steel Rod')],
  );
}

describe('ManufacturingInstruction', () => {
  it('registering a standard BOM sets its fields and components', () => {
    const productId = Identity.new();
    const sut = registerManufacturingInstruction(productId);

    expect(sut.miCode().asString()).toBe('1234');
    expect(sut.brand().asString()).toBe('Legrand');
    expect(sut.standardLength().asNumber()).toBe(305);
    expect(sut.active()).toBe(true);
    expect(sut.description()).toBe('Standard for network cables');
    expect(sut.productId().equals(productId)).toBe(true);
    expect(sut.productName()).toBe('Widget');
    expect(sut.components()).toHaveLength(1);
    expect(sut.components()[0].name()).toBe('Bolt');
  });

  it('registering a standard BOM records a ManufacturingInstructionRegistered event carrying everything it was registered with', () => {
    const productId = Identity.new();
    const sut = ManufacturingInstruction.register(
      MiCode.fromString('1234'),
      Brand.fromString('Legrand'),
      StandardLength.of(305),
      true,
      undefined,
      productId,
      'Widget',
      [
        ManufacturingInstructionComponentLine.of(Identity.new(), 'Bolt', [
          ManufacturingInstructionMaterialLine.of(
            Identity.new(),
            'Steel Rod',
            Weight.ofGrams(150),
          ),
          ManufacturingInstructionMaterialLine.of(
            Identity.new(),
            'Zinc',
            Weight.ofGrams(2.5),
          ),
        ]),
      ],
    );

    expect(sut.releaseEvents()).toEqual([
      new ManufacturingInstructionRegistered(sut.id.asString(), {
        miCode: '1234',
        brand: 'Legrand',
        standardLength: 305,
        active: true,
        description: undefined,
        productId: productId.asString(),
        productName: 'Widget',
        components: [
          {
            name: 'Bolt',
            materials: [
              { name: 'Steel Rod', weightInGrams: 150 },
              { name: 'Zinc', weightInGrams: 2.5 },
            ],
          },
        ],
      }),
    ]);
  });

  it('rejects registering a standard BOM with no components', () => {
    expect(() =>
      ManufacturingInstruction.register(
        MiCode.fromString('1234'),
        Brand.fromString('Legrand'),
        StandardLength.of(305),
        true,
        undefined,
        Identity.new(),
        'Widget',
        [],
      ),
    ).toThrow();
  });

  it('editing a standard BOM changes its fields and records a ManufacturingInstructionEdited event carrying every changed field', () => {
    const sut = registerManufacturingInstruction();
    sut.releaseEvents();

    sut.edit(
      MiCode.fromString('5678'),
      Brand.fromString('Schneider'),
      StandardLength.of(500),
      'Updated description',
      false,
    );

    expect(sut.miCode().asString()).toBe('5678');
    expect(sut.brand().asString()).toBe('Schneider');
    expect(sut.standardLength().asNumber()).toBe(500);
    expect(sut.description()).toBe('Updated description');
    expect(sut.active()).toBe(false);
    expect(sut.releaseEvents()).toEqual([
      new ManufacturingInstructionEdited(
        sut.id.asString(),
        '5678',
        'Schneider',
        500,
        'Updated description',
        false,
        [
          { field: 'miCode', previousValue: '1234', newValue: '5678' },
          { field: 'brand', previousValue: 'Legrand', newValue: 'Schneider' },
          {
            field: 'standardLength',
            previousValue: '305',
            newValue: '500',
          },
          {
            field: 'description',
            previousValue: 'Standard for network cables',
            newValue: 'Updated description',
          },
          { field: 'active', previousValue: 'true', newValue: 'false' },
        ],
      ),
    ]);
  });

  it('editing a standard BOM records only the fields that actually changed, in the order checked', () => {
    const sut = registerManufacturingInstruction();
    sut.releaseEvents();

    sut.edit(
      sut.miCode(),
      Brand.fromString('Nexans'),
      StandardLength.of(310),
      sut.description(),
      sut.active(),
    );

    const [event] = sut.releaseEvents();
    expect(event).toEqual(
      new ManufacturingInstructionEdited(
        sut.id.asString(),
        '1234',
        'Nexans',
        310,
        'Standard for network cables',
        true,
        [
          { field: 'brand', previousValue: 'Legrand', newValue: 'Nexans' },
          {
            field: 'standardLength',
            previousValue: '305',
            newValue: '310',
          },
        ],
      ),
    );
  });

  it('editing a standard BOM with every field unchanged records no event', () => {
    const sut = registerManufacturingInstruction();
    sut.releaseEvents();

    sut.edit(
      sut.miCode(),
      sut.brand(),
      sut.standardLength(),
      sut.description(),
      sut.active(),
    );

    expect(sut.releaseEvents()).toEqual([]);
  });

  it('editing a standard BOM with new components replaces the previous list and records one ManufacturingInstructionEdited event carrying the composition before and after, even when no scalar field changed', () => {
    const sut = registerManufacturingInstruction();
    sut.releaseEvents();
    const newComponents = [
      componentLine(Identity.new(), 'Nut', Identity.new(), 'Copper Wire'),
    ];

    sut.edit(
      sut.miCode(),
      sut.brand(),
      sut.standardLength(),
      sut.description(),
      sut.active(),
      newComponents,
    );

    expect(sut.components()).toEqual(newComponents);
    expect(sut.releaseEvents()).toEqual([
      new ManufacturingInstructionEdited(
        sut.id.asString(),
        '1234',
        'Legrand',
        305,
        'Standard for network cables',
        true,
        [],
        {
          previous: [
            {
              name: 'Bolt',
              materials: [{ name: 'Steel Rod', weightInGrams: 150 }],
            },
          ],
          current: [
            {
              name: 'Nut',
              materials: [{ name: 'Copper Wire', weightInGrams: 150 }],
            },
          ],
        },
      ),
    ]);
  });

  it('editing a standard BOM fields and components together records a single event', () => {
    const sut = registerManufacturingInstruction();
    sut.releaseEvents();

    sut.edit(
      sut.miCode(),
      Brand.fromString('Nexans'),
      sut.standardLength(),
      sut.description(),
      sut.active(),
      [componentLine(Identity.new(), 'Nut', Identity.new(), 'Copper Wire')],
    );

    expect(sut.releaseEvents()).toHaveLength(1);
  });

  it('editing a standard BOM with the components it already has records no event', () => {
    const sut = registerManufacturingInstruction();
    sut.releaseEvents();

    sut.edit(
      sut.miCode(),
      sut.brand(),
      sut.standardLength(),
      sut.description(),
      sut.active(),
      [...sut.components()],
    );

    expect(sut.releaseEvents()).toEqual([]);
  });

  it('rejects editing a standard BOM to have no components', () => {
    const sut = registerManufacturingInstruction();

    expect(() =>
      sut.edit(
        sut.miCode(),
        sut.brand(),
        sut.standardLength(),
        sut.description(),
        sut.active(),
        [],
      ),
    ).toThrow();
  });

  it('deleting a standard BOM records a ManufacturingInstructionDeleted event carrying the standard BOM as it stood at deletion', () => {
    const productId = Identity.new();
    const sut = registerManufacturingInstruction(productId);
    sut.edit(
      sut.miCode(),
      Brand.fromString('Nexans'),
      sut.standardLength(),
      sut.description(),
      false,
    );
    sut.releaseEvents();

    sut.delete();

    expect(sut.releaseEvents()).toEqual([
      new ManufacturingInstructionDeleted(sut.id.asString(), {
        miCode: '1234',
        brand: 'Nexans',
        standardLength: 305,
        active: false,
        description: 'Standard for network cables',
        productId: productId.asString(),
        productName: 'Widget',
        components: [
          {
            name: 'Bolt',
            materials: [{ name: 'Steel Rod', weightInGrams: 150 }],
          },
        ],
      }),
    ]);
  });

  it('reconstructing a standard BOM from persistence records no event', () => {
    const id = Identity.new();
    const productId = Identity.new();
    const components = [
      componentLine(Identity.new(), 'Bolt', Identity.new(), 'Steel Rod'),
    ];

    const sut = ManufacturingInstruction.fromPersistence(
      id,
      MiCode.fromString('1234'),
      Brand.fromString('Legrand'),
      StandardLength.of(305),
      true,
      undefined,
      productId,
      'Widget',
      components,
    );

    expect(sut.id.equals(id)).toBe(true);
    expect(sut.miCode().asString()).toBe('1234');
    expect(sut.releaseEvents()).toEqual([]);
  });
});
