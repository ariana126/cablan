import { AggregateRoot, Identity } from '@framework/domain';

import { ProductComponentSnapshot } from './events/product-component.snapshot';
import { ProductComponentsReordered } from './events/product-components-reordered.event';
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
        Product.snapshotOf(components),
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
    // Renaming to the current name is not a change: no event, so no audit
    // entry showing a value "changed" to itself.
    if (name.asString() === this._name.asString()) {
      return;
    }
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
   * Gives the product the composition `components`, which is one of three
   * things:
   *
   * - **the same** components and materials, by id, in the same order — no
   *   change, no event;
   * - **a reordering** (issue #122): the same lines in another order, each
   *   component keeping its own materials in their order — the product's
   *   own lines are laid out in the new order (keeping the names they
   *   recorded) and `ProductComponentsReordered` is recorded;
   * - anything else — **a new composition**, replacing the previous one
   *   wholesale rather than merged with it, recorded as
   *   `ProductComponentsUpdated`.
   */
  public updateComponents(components: ProductComponentLine[]): void {
    Product.assertHasAtLeastOneComponent(components);
    if (this.changesOnlyCorrectableFields(components)) {
      return;
    }
    const reordered = this.ownLinesIn(components);
    if (reordered !== null) {
      const previous = this._components;
      this._components = reordered;
      this.recordThat(
        new ProductComponentsReordered(
          this.id.asString(),
          Product.namesOf(previous),
          Product.namesOf(reordered),
          Product.componentIdsOf(reordered),
        ),
      );
      return;
    }
    this._components = components;
    this.recordThat(
      new ProductComponentsUpdated(
        this.id.asString(),
        Product.componentIdsOf(components),
      ),
    );
  }

  /**
   * Whether `components` is a reordering of the product's composition
   * (issue #122): the same components, each with the same materials in the
   * same order, by id, laid out in another order. The composition resent
   * as it is is not one.
   */
  public reordersComponents(
    components: readonly ProductComponentLine[],
  ): boolean {
    return (
      !this.changesOnlyCorrectableFields(components) &&
      this.ownLinesIn(components) !== null
    );
  }

  /**
   * Hard delete: nothing else references a product yet, so the row is
   * removed outright by the repository's `delete()` rather than kept
   * behind a flag — mirroring `Component.delete()` and `Material.delete()`.
   * The underlying `Component`/`Material` master rows are left in place:
   * they are standalone aggregates with their own lifecycle and outlive
   * the product that once composed them.
   */
  public delete(): void {
    this.recordThat(
      new ProductDeleted(
        this.id.asString(),
        this._name.asString(),
        Product.snapshotOf(this._components),
      ),
    );
  }

  public name(): ProductName {
    return this._name;
  }

  /**
   * Whether any of the product's components carries this material — what
   * refuses reverting a bulk import whose registered material a product has
   * since been composed with.
   */
  public usesMaterial(materialId: Identity): boolean {
    return this._components.some((component) =>
      component
        .materials()
        .some((material) => material.materialId().equals(materialId)),
    );
  }

  public components(): ProductComponentLine[] {
    return this._components;
  }

  /**
   * Whether an edit giving `components` (or none) changes nothing but the
   * product's correctable field, its name (issue #110): its composition is
   * the same components and materials, by id, in the same order. The names
   * the lines recorded are snapshots and play no part.
   */
  public changesOnlyCorrectableFields(
    components: readonly ProductComponentLine[] | undefined,
  ): boolean {
    if (components === undefined) {
      return true;
    }
    return (
      components.length === this._components.length &&
      components.every((component, index) =>
        Product.sameLine(component, this._components[index]),
      )
    );
  }

  /**
   * The product's own lines laid out in the order of `components`, each
   * matched by `sameLine` to one line not yet taken — or `null` when
   * `components` is not a permutation of them.
   */
  private ownLinesIn(
    components: readonly ProductComponentLine[],
  ): ProductComponentLine[] | null {
    if (components.length !== this._components.length) {
      return null;
    }
    const remaining = [...this._components];
    const ordered: ProductComponentLine[] = [];
    for (const component of components) {
      const index = remaining.findIndex((own) =>
        Product.sameLine(own, component),
      );
      if (index === -1) {
        return null;
      }
      ordered.push(...remaining.splice(index, 1));
    }
    return ordered;
  }

  private static namesOf(components: readonly ProductComponentLine[]) {
    return components.map((component) => component.name());
  }

  private static componentIdsOf(components: readonly ProductComponentLine[]) {
    return components.map((component) => component.componentId().asString());
  }

  private static sameLine(
    left: ProductComponentLine,
    right: ProductComponentLine,
  ): boolean {
    const leftMaterials = left.materials();
    const rightMaterials = right.materials();
    return (
      left.componentId().equals(right.componentId()) &&
      leftMaterials.length === rightMaterials.length &&
      leftMaterials.every((material, index) =>
        material.materialId().equals(rightMaterials[index].materialId()),
      )
    );
  }

  private static snapshotOf(
    components: ProductComponentLine[],
  ): ProductComponentSnapshot[] {
    return components.map((component) => ({
      name: component.name(),
      materials: component
        .materials()
        .map((material) => ({ name: material.name() })),
    }));
  }

  private static assertHasAtLeastOneComponent(
    components: ProductComponentLine[],
  ): void {
    if (components.length === 0) {
      throw new Error('A product must have at least one component');
    }
  }
}
