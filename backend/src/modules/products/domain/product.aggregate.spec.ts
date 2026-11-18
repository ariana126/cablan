import { Identity } from '@framework/domain';

import { ProductComponentsReordered } from './events/product-components-reordered.event';
import { ProductComponentsUpdated } from './events/product-components-updated.event';
import { ProductDeleted } from './events/product-deleted.event';
import { ProductRegistered } from './events/product-registered.event';
import { ProductRenamed } from './events/product-renamed.event';
import { Product } from './product.aggregate';
import { ProductComponentLine } from './value/product-component-line.vo';
import { ProductMaterialLine } from './value/product-material-line.vo';
import { ProductName } from './value/product-name.vo';

function componentLine(
  componentId: Identity,
  name: string,
  materialId: Identity,
  materialName: string,
): ProductComponentLine {
  return ProductComponentLine.of(componentId, name, [
    ProductMaterialLine.of(materialId, materialName),
  ]);
}

function registerProduct(): Product {
  return Product.register(ProductName.fromString('Widget'), [
    componentLine(Identity.new(), 'Bolt', Identity.new(), 'Steel Rod'),
  ]);
}

describe('Product', () => {
  it('registering a product sets its name and components', () => {
    const sut = registerProduct();

    expect(sut.name().asString()).toBe('Widget');
    expect(sut.components()).toHaveLength(1);
    expect(sut.components()[0].name()).toBe('Bolt');
  });

  it('registering a product records a ProductRegistered event carrying its name and composition', () => {
    const sut = Product.register(ProductName.fromString('Widget'), [
      ProductComponentLine.of(Identity.new(), 'Bolt', [
        ProductMaterialLine.of(Identity.new(), 'Steel Rod'),
        ProductMaterialLine.of(Identity.new(), 'Zinc'),
      ]),
    ]);

    expect(sut.releaseEvents()).toEqual([
      new ProductRegistered(sut.id.asString(), 'Widget', [
        { name: 'Bolt', materials: [{ name: 'Steel Rod' }, { name: 'Zinc' }] },
      ]),
    ]);
  });

  it('rejects registering a product with no components', () => {
    expect(() =>
      Product.register(ProductName.fromString('Widget'), []),
    ).toThrow();
  });

  it('renaming a product changes its name and records a ProductRenamed event', () => {
    const sut = registerProduct();
    sut.releaseEvents();

    sut.rename(ProductName.fromString('Gadget'));

    expect(sut.name().asString()).toBe('Gadget');
    expect(sut.releaseEvents()).toEqual([
      new ProductRenamed(sut.id.asString(), 'Widget', 'Gadget'),
    ]);
  });

  it("updating a product's components replaces the previous list and records a ProductComponentsUpdated event", () => {
    const sut = registerProduct();
    sut.releaseEvents();
    const newComponentId = Identity.new();
    const newComponents = [
      componentLine(newComponentId, 'Nut', Identity.new(), 'Copper Wire'),
    ];

    sut.updateComponents(newComponents);

    expect(sut.components()).toEqual(newComponents);
    expect(sut.releaseEvents()).toEqual([
      new ProductComponentsUpdated(sut.id.asString(), [
        newComponentId.asString(),
      ]),
    ]);
  });

  it('rejects updating a product to have no components', () => {
    const sut = registerProduct();

    expect(() => sut.updateComponents([])).toThrow();
  });

  it('renaming a product to its current name records no event', () => {
    const sut = registerProduct();
    sut.releaseEvents();

    sut.rename(ProductName.fromString('Widget'));

    expect(sut.releaseEvents()).toEqual([]);
  });

  it('deleting a product records a ProductDeleted event carrying its name and composition as they stood at deletion', () => {
    const sut = registerProduct();
    sut.rename(ProductName.fromString('Gadget'));
    sut.updateComponents([
      componentLine(Identity.new(), 'Nut', Identity.new(), 'Copper Wire'),
    ]);
    sut.releaseEvents();

    sut.delete();

    expect(sut.releaseEvents()).toEqual([
      new ProductDeleted(sut.id.asString(), 'Gadget', [
        { name: 'Nut', materials: [{ name: 'Copper Wire' }] },
      ]),
    ]);
  });

  it('reconstructing a product from persistence records no event', () => {
    const id = Identity.new();
    const components = [
      componentLine(Identity.new(), 'Bolt', Identity.new(), 'Steel Rod'),
    ];

    const sut = Product.fromPersistence(
      id,
      ProductName.fromString('Widget'),
      components,
    );

    expect(sut.id.equals(id)).toBe(true);
    expect(sut.name().asString()).toBe('Widget');
    expect(sut.releaseEvents()).toEqual([]);
  });

  it('a product uses a material that is in one of its components', () => {
    const steelRod = Identity.new();
    const sut = Product.register(ProductName.fromString('Widget'), [
      componentLine(Identity.new(), 'Bolt', Identity.new(), 'Copper'),
      componentLine(Identity.new(), 'Nut', steelRod, 'Steel Rod'),
    ]);

    expect(sut.usesMaterial(steelRod)).toBe(true);
  });

  it('a product does not use a material absent from its composition', () => {
    const sut = registerProduct();

    expect(sut.usesMaterial(Identity.new())).toBe(false);
  });

  // Issue #110: a correction may rename a product only when the edit leaves
  // its composition as it is — compared by component and material ids, in
  // order, never by the names the lines recorded (reviewer L4).
  describe('whether an edit changes only its correctable fields', () => {
    const bolt = Identity.new();
    const nut = Identity.new();
    const steel = Identity.new();
    const copper = Identity.new();
    const product = () =>
      Product.register(ProductName.fromString('Widget'), [
        componentLine(bolt, 'Bolt', steel, 'Steel Rod'),
        componentLine(nut, 'Nut', copper, 'Copper'),
      ]);

    it('does, when it gives no composition', () => {
      expect(product().changesOnlyCorrectableFields()).toBe(true);
    });

    it('does, for the same components and materials in the same order, whatever names they recorded', () => {
      expect(
        product().changesOnlyCorrectableFields([
          componentLine(bolt, 'Bolt (old name)', steel, 'Steel'),
          componentLine(nut, 'Nut', copper, 'Copper'),
        ]),
      ).toBe(true);
    });

    it('does not, for another material', () => {
      expect(
        product().changesOnlyCorrectableFields([
          componentLine(bolt, 'Bolt', Identity.new(), 'Copper'),
          componentLine(nut, 'Nut', copper, 'Copper'),
        ]),
      ).toBe(false);
    });

    it('does not, for a component less', () => {
      expect(
        product().changesOnlyCorrectableFields([
          componentLine(bolt, 'Bolt', steel, 'Steel Rod'),
        ]),
      ).toBe(false);
    });

    it('does not, for its components reordered', () => {
      expect(
        product().changesOnlyCorrectableFields([
          componentLine(nut, 'Nut', copper, 'Copper'),
          componentLine(bolt, 'Bolt', steel, 'Steel Rod'),
        ]),
      ).toBe(false);
    });
  });

  // Issue #122: the order of a product's components is its own, and a
  // reordering is a change of its own kind — not a new composition.
  describe('reordering its components', () => {
    const conductor = Identity.new();
    const insulation = Identity.new();
    const sheath = Identity.new();
    const copper = Identity.new();
    const zinc = Identity.new();
    const pvc = Identity.new();
    const pe = Identity.new();
    const conductorLine = (name = 'هادی') =>
      ProductComponentLine.of(conductor, name, [
        ProductMaterialLine.of(copper, 'مس'),
        ProductMaterialLine.of(zinc, 'روی'),
      ]);
    const insulationLine = () => componentLine(insulation, 'عایق', pvc, 'PVC');
    const sheathLine = (name = 'روکش') => componentLine(sheath, name, pe, 'PE');
    const cable = () => {
      const product = Product.register(ProductName.fromString('کابل'), [
        conductorLine(),
        insulationLine(),
        sheathLine(),
      ]);
      product.releaseEvents();
      return product;
    };
    const reordered = () => [sheathLine(), conductorLine(), insulationLine()];

    it('lays its components out in the new order, each with its own materials', () => {
      const sut = cable();

      sut.updateComponents(reordered());

      expect(sut.components()).toEqual(reordered());
    });

    it('records a ProductComponentsReordered event with the names before and after and the new order of ids', () => {
      const sut = cable();

      sut.updateComponents(reordered());

      expect(sut.releaseEvents()).toEqual([
        new ProductComponentsReordered(
          sut.id.asString(),
          ['هادی', 'عایق', 'روکش'],
          ['روکش', 'هادی', 'عایق'],
          [sheath.asString(), conductor.asString(), insulation.asString()],
        ),
      ]);
    });

    it('keeps the names its lines recorded, whatever names the reordered lines carry', () => {
      const sut = cable();

      sut.updateComponents([
        sheathLine('روکش (نام دیگر)'),
        conductorLine(),
        insulationLine(),
      ]);

      expect(sut.components()[0].name()).toBe('روکش');
    });

    it('records nothing for its composition resent as it is', () => {
      const sut = cable();

      sut.updateComponents([conductorLine(), insulationLine(), sheathLine()]);

      expect(sut.releaseEvents()).toEqual([]);
    });

    it('is a new composition when a reordered component also changes its materials', () => {
      const sut = cable();

      sut.updateComponents([
        sheathLine(),
        componentLine(conductor, 'هادی', copper, 'مس'),
        insulationLine(),
      ]);

      expect(sut.releaseEvents()).toEqual([
        new ProductComponentsUpdated(sut.id.asString(), [
          sheath.asString(),
          conductor.asString(),
          insulation.asString(),
        ]),
      ]);
    });

    it('is a reordering for the same components and materials in another order', () => {
      expect(cable().reordersComponents(reordered())).toBe(true);
    });

    it('is not a reordering for its composition resent as it is', () => {
      expect(
        cable().reordersComponents([
          conductorLine(),
          insulationLine(),
          sheathLine(),
        ]),
      ).toBe(false);
    });

    it('is not a reordering when a component is added', () => {
      expect(
        cable().reordersComponents([
          ...reordered(),
          componentLine(Identity.new(), 'زره', Identity.new(), 'فولاد'),
        ]),
      ).toBe(false);
    });

    it("is not a reordering when a component's materials change order", () => {
      expect(
        cable().reordersComponents([
          sheathLine(),
          ProductComponentLine.of(conductor, 'هادی', [
            ProductMaterialLine.of(zinc, 'روی'),
            ProductMaterialLine.of(copper, 'مس'),
          ]),
          insulationLine(),
        ]),
      ).toBe(false);
    });
  });
});
