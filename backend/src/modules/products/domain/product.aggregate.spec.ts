import { Identity } from '@framework/domain';

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

  it('registering a product records a ProductRegistered event', () => {
    const componentId = Identity.new();
    const sut = Product.register(ProductName.fromString('Widget'), [
      componentLine(componentId, 'Bolt', Identity.new(), 'Steel Rod'),
    ]);

    expect(sut.releaseEvents()).toEqual([
      new ProductRegistered(sut.id.asString(), 'Widget', [
        componentId.asString(),
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

  it('deleting a product records a ProductDeleted event', () => {
    const sut = registerProduct();
    sut.releaseEvents();

    sut.delete();

    expect(sut.releaseEvents()).toEqual([
      new ProductDeleted(sut.id.asString(), 'Widget'),
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
});
