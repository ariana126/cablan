import { Identity } from '@framework/domain';

import { Bom } from './bom.aggregate';
import { BomComponentsUpdated } from './events/bom-components-updated.event';
import { BomDeleted } from './events/bom-deleted.event';
import { BomEdited } from './events/bom-edited.event';
import { BomRegistered } from './events/bom-registered.event';
import { BomComponentLine } from './value/bom-component-line.vo';
import { BomMaterialLine } from './value/bom-material-line.vo';
import { OrderNumber } from './value/order-number.vo';
import { TrackingNumber } from './value/tracking-number.vo';
import { Weight } from './value/weight.vo';

function componentLine(
  componentId: Identity,
  name: string,
  materialId: Identity,
  materialName: string,
): BomComponentLine {
  return BomComponentLine.of(componentId, name, [
    BomMaterialLine.of(materialId, materialName, Weight.ofGrams(150)),
  ]);
}

function registerBom(standardBomId: Identity = Identity.new()): Bom {
  return Bom.register(
    standardBomId,
    '1234',
    'Legrand',
    'Product 1',
    305,
    OrderNumber.fromString('SO-1234'),
    TrackingNumber.fromString('TN-5678'),
    'Daily BOM for order 1234',
    'Sina',
    [componentLine(Identity.new(), 'Bolt', Identity.new(), 'Steel Rod')],
  );
}

describe('Bom', () => {
  it('registering a BOM sets its fields and components', () => {
    const standardBomId = Identity.new();
    const sut = registerBom(standardBomId);

    expect(sut.standardBomId().equals(standardBomId)).toBe(true);
    expect(sut.standardBomMiCode()).toBe('1234');
    expect(sut.brand()).toBe('Legrand');
    expect(sut.productName()).toBe('Product 1');
    expect(sut.standardLength()).toBe(305);
    expect(sut.orderNumber().asString()).toBe('SO-1234');
    expect(sut.trackingNumber().asString()).toBe('TN-5678');
    expect(sut.description()).toBe('Daily BOM for order 1234');
    expect(sut.registeredBy()).toBe('Sina');
    expect(sut.components()).toHaveLength(1);
    expect(sut.components()[0].name()).toBe('Bolt');
  });

  it('registering a BOM records a BomRegistered event', () => {
    const standardBomId = Identity.new();
    const componentId = Identity.new();
    const sut = Bom.register(
      standardBomId,
      '1234',
      'Legrand',
      'Product 1',
      305,
      OrderNumber.fromString('SO-1234'),
      TrackingNumber.fromString('TN-5678'),
      undefined,
      'Sina',
      [componentLine(componentId, 'Bolt', Identity.new(), 'Steel Rod')],
    );

    expect(sut.releaseEvents()).toEqual([
      new BomRegistered(
        sut.id.asString(),
        standardBomId.asString(),
        'SO-1234',
        'TN-5678',
        [componentId.asString()],
      ),
    ]);
  });

  it('rejects registering a BOM with no components', () => {
    expect(() =>
      Bom.register(
        Identity.new(),
        '1234',
        'Legrand',
        'Product 1',
        305,
        OrderNumber.fromString('SO-1234'),
        TrackingNumber.fromString('TN-5678'),
        undefined,
        'Sina',
        [],
      ),
    ).toThrow();
  });

  it('editing a BOM changes its fields and records a BomEdited event carrying every changed field, leaving the cloned reporting fields untouched', () => {
    const sut = registerBom();
    sut.releaseEvents();

    sut.edit(
      OrderNumber.fromString('SO-9999'),
      TrackingNumber.fromString('TN-0000'),
      'Updated description',
    );

    expect(sut.orderNumber().asString()).toBe('SO-9999');
    expect(sut.trackingNumber().asString()).toBe('TN-0000');
    expect(sut.description()).toBe('Updated description');
    expect(sut.standardBomMiCode()).toBe('1234');
    expect(sut.brand()).toBe('Legrand');
    expect(sut.productName()).toBe('Product 1');
    expect(sut.standardLength()).toBe(305);
    expect(sut.registeredBy()).toBe('Sina');
    expect(sut.releaseEvents()).toEqual([
      new BomEdited(
        sut.id.asString(),
        'SO-9999',
        'TN-0000',
        'Updated description',
        [
          {
            field: 'orderNumber',
            previousValue: 'SO-1234',
            newValue: 'SO-9999',
          },
          {
            field: 'trackingNumber',
            previousValue: 'TN-5678',
            newValue: 'TN-0000',
          },
          {
            field: 'description',
            previousValue: 'Daily BOM for order 1234',
            newValue: 'Updated description',
          },
        ],
      ),
    ]);
  });

  it('editing a BOM with only its tracking number changed records just that one field', () => {
    const sut = registerBom();
    sut.releaseEvents();

    sut.edit(
      sut.orderNumber(),
      TrackingNumber.fromString('TN-0000'),
      sut.description(),
    );

    const [event] = sut.releaseEvents();
    expect(event).toEqual(
      new BomEdited(
        sut.id.asString(),
        'SO-1234',
        'TN-0000',
        'Daily BOM for order 1234',
        [
          {
            field: 'trackingNumber',
            previousValue: 'TN-5678',
            newValue: 'TN-0000',
          },
        ],
      ),
    );
  });

  it('editing a BOM with every field unchanged records no changes', () => {
    const sut = registerBom();
    sut.releaseEvents();

    sut.edit(sut.orderNumber(), sut.trackingNumber(), sut.description());

    const [event] = sut.releaseEvents();
    expect(event.changes).toEqual([]);
  });

  it("updating a BOM's components replaces the previous list and records a BomComponentsUpdated event", () => {
    const sut = registerBom();
    sut.releaseEvents();
    const newComponentId = Identity.new();
    const newComponents = [
      componentLine(newComponentId, 'Nut', Identity.new(), 'Copper Wire'),
    ];

    sut.updateComponents(newComponents);

    expect(sut.components()).toEqual(newComponents);
    expect(sut.releaseEvents()).toEqual([
      new BomComponentsUpdated(sut.id.asString(), [newComponentId.asString()]),
    ]);
  });

  it('rejects updating a BOM to have no components', () => {
    const sut = registerBom();

    expect(() => sut.updateComponents([])).toThrow();
  });

  it('deleting a BOM records a BomDeleted event', () => {
    const sut = registerBom();
    sut.releaseEvents();

    sut.delete();

    expect(sut.releaseEvents()).toEqual([
      new BomDeleted(sut.id.asString(), 'SO-1234'),
    ]);
  });

  it('reconstructing a BOM from persistence records no event', () => {
    const id = Identity.new();
    const standardBomId = Identity.new();
    const components = [
      componentLine(Identity.new(), 'Bolt', Identity.new(), 'Steel Rod'),
    ];

    const sut = Bom.fromPersistence(
      id,
      standardBomId,
      '1234',
      'Legrand',
      'Product 1',
      305,
      OrderNumber.fromString('SO-1234'),
      TrackingNumber.fromString('TN-5678'),
      undefined,
      'Sina',
      components,
    );

    expect(sut.id.equals(id)).toBe(true);
    expect(sut.orderNumber().asString()).toBe('SO-1234');
    expect(sut.releaseEvents()).toEqual([]);
  });
});
