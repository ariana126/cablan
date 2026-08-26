import { AggregateRoot, Identity } from '@framework/domain';

import { ProductComponentsUpdated } from './events/product-components-updated.event';
import { ProductDeleted } from './events/product-deleted.event';
import { ProductRegistered } from './events/product-registered.event';
import { ProductRenamed } from './events/product-renamed.event';
import { ProductComponentLine } from './value/product-component-line.vo';
import { ProductName } from './value/product-name.vo';

export class Product extends AggregateRoot {
  private constructor(
    id: Identity,
    private _name: ProductName,
    private _components: ProductComponentLine[],
  ) {
    super(id);
  }

  public static register(
    name: ProductName,
    components: ProductComponentLine[],
  ): Product {
    Product.assertHasAtLeastOneComponent(components);
    const product = new Product(Identity.new(), name, components);
    product.recordThat(
      new ProductRegistered(
        product.id.asString(),
        name.asString(),
        components.map((component) => component.componentId().asString()),
      ),
    );
    return product;
  }

  /**
   * Rehydrates a `Product` from storage — for `PrismaProductRepository`'s
   * `toDomain()` only. Unlike `register()`, this records no event: loading
   * an existing row is not a new business fact.
   */
  public static fromPersistence(
    id: Identity,
    name: ProductName,
    components: ProductComponentLine[],
  ): Product {
    return new Product(id, name, components);
  }

  public rename(name: ProductName): void {
    const previousName = this._name;
    this._name = name;
    this.recordThat(
      new ProductRenamed(
        this.id.asString(),
        previousName.asString(),
        name.asString(),
      ),
    );
  }

  /**
   * Replaces the product's component composition wholesale. There is no
   * partial, line-by-line edit: every component (and every material within
   * it) supplied here is a newly registered row, never a reused one (see
   * `ProductCompositionFactory`), so the previous composition is discarded
   * in full rather than merged with it.
   */
  public updateComponents(components: ProductComponentLine[]): void {
    Product.assertHasAtLeastOneComponent(components);
    this._components = components;
    this.recordThat(
      new ProductComponentsUpdated(
        this.id.asString(),
        components.map((component) => component.componentId().asString()),
      ),
    );
  }

  /**
   * Hard delete: nothing else references a product yet, so the row is
   * removed outright by the repository's `delete()` rather than kept
   * behind a flag — mirroring `Component.delete()` and `Material.delete()`.
   * The underlying `Component`/`Material` master rows are left in place:
   * they are standalone aggregates owned by their own modules and outlive
   * the product that once composed them.
   */
  public delete(): void {
    this.recordThat(
      new ProductDeleted(this.id.asString(), this._name.asString()),
    );
  }

  public name(): ProductName {
    return this._name;
  }

  public components(): ProductComponentLine[] {
    return this._components;
  }

  private static assertHasAtLeastOneComponent(
    components: ProductComponentLine[],
  ): void {
    if (components.length === 0) {
      throw new Error('A product must have at least one component');
    }
  }
}
