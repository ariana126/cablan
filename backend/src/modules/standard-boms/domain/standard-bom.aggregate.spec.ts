import { Identity } from '@framework/domain';

import { StandardBomComponentsUpdated } from './events/standard-bom-components-updated.event';
import { StandardBomDeleted } from './events/standard-bom-deleted.event';
import { StandardBomEdited } from './events/standard-bom-edited.event';
import { StandardBomRegistered } from './events/standard-bom-registered.event';
import { StandardBom } from './standard-bom.aggregate';
import { Brand } from './value/brand.vo';
import { MiCode } from './value/mi-code.vo';
import { StandardBomComponentLine } from './value/standard-bom-component-line.vo';
import { StandardBomMaterialLine } from './value/standard-bom-material-line.vo';
import { StandardLength } from './value/standard-length.vo';
import { Weight } from './value/weight.vo';

function componentLine(
  componentId: Identity,
  name: string,
  materialId: Identity,
  materialName: string,
): StandardBomComponentLine {
  return StandardBomComponentLine.of(componentId, name, [
    StandardBomMaterialLine.of(materialId, materialName, Weight.ofGrams(150)),
  ]);
}

function registerStandardBom(
  productId: Identity = Identity.new(),
): StandardBom {
  return StandardBom.register(
    MiCode.fromString('1234'),
    Brand.fromString('Legrand'),
    StandardLength.of(305),
    true,
    'Standard for network cables',
    productId,
    [componentLine(Identity.new(), 'Bolt', Identity.new(), 'Steel Rod')],
  );
}

describe('StandardBom', () => {
  it('registering a standard BOM sets its fields and components', () => {
    const productId = Identity.new();
    const sut = registerStandardBom(productId);

    expect(sut.miCode().asString()).toBe('1234');
    expect(sut.brand().asString()).toBe('Legrand');
    expect(sut.standardLength().asNumber()).toBe(305);
    expect(sut.active()).toBe(true);
    expect(sut.description()).toBe('Standard for network cables');
    expect(sut.productId().equals(productId)).toBe(true);
    expect(sut.components()).toHaveLength(1);
    expect(sut.components()[0].name()).toBe('Bolt');
  });

  it('registering a standard BOM records a StandardBomRegistered event', () => {
    const productId = Identity.new();
    const componentId = Identity.new();
    const sut = StandardBom.register(
      MiCode.fromString('1234'),
      Brand.fromString('Legrand'),
      StandardLength.of(305),
      true,
      undefined,
      productId,
      [componentLine(componentId, 'Bolt', Identity.new(), 'Steel Rod')],
    );

    expect(sut.releaseEvents()).toEqual([
      new StandardBomRegistered(
        sut.id.asString(),
        '1234',
        productId.asString(),
        [componentId.asString()],
      ),
    ]);
  });

  it('rejects registering a standard BOM with no components', () => {
    expect(() =>
      StandardBom.register(
        MiCode.fromString('1234'),
        Brand.fromString('Legrand'),
        StandardLength.of(305),
        true,
        undefined,
        Identity.new(),
        [],
      ),
    ).toThrow();
  });

  it('editing a standard BOM changes its fields and records a StandardBomEdited event', () => {
    const sut = registerStandardBom();
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
      new StandardBomEdited(
        sut.id.asString(),
        '5678',
        'Schneider',
        500,
        'Updated description',
        false,
      ),
    ]);
  });

  it("updating a standard BOM's components replaces the previous list and records a StandardBomComponentsUpdated event", () => {
    const sut = registerStandardBom();
    sut.releaseEvents();
    const newComponentId = Identity.new();
    const newComponents = [
      componentLine(newComponentId, 'Nut', Identity.new(), 'Copper Wire'),
    ];

    sut.updateComponents(newComponents);

    expect(sut.components()).toEqual(newComponents);
    expect(sut.releaseEvents()).toEqual([
      new StandardBomComponentsUpdated(sut.id.asString(), [
        newComponentId.asString(),
      ]),
    ]);
  });

  it('rejects updating a standard BOM to have no components', () => {
    const sut = registerStandardBom();

    expect(() => sut.updateComponents([])).toThrow();
  });

  it('deleting a standard BOM records a StandardBomDeleted event', () => {
    const sut = registerStandardBom();
    sut.releaseEvents();

    sut.delete();

    expect(sut.releaseEvents()).toEqual([
      new StandardBomDeleted(sut.id.asString(), '1234'),
    ]);
  });

  it('reconstructing a standard BOM from persistence records no event', () => {
    const id = Identity.new();
    const productId = Identity.new();
    const components = [
      componentLine(Identity.new(), 'Bolt', Identity.new(), 'Steel Rod'),
    ];

    const sut = StandardBom.fromPersistence(
      id,
      MiCode.fromString('1234'),
      Brand.fromString('Legrand'),
      StandardLength.of(305),
      true,
      undefined,
      productId,
      components,
    );

    expect(sut.id.equals(id)).toBe(true);
    expect(sut.miCode().asString()).toBe('1234');
    expect(sut.releaseEvents()).toEqual([]);
  });
});
