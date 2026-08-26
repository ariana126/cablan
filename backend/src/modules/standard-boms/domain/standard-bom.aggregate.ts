import { AggregateRoot, Identity } from '@framework/domain';

import { StandardBomComponentsUpdated } from './events/standard-bom-components-updated.event';
import { StandardBomDeleted } from './events/standard-bom-deleted.event';
import { StandardBomEdited } from './events/standard-bom-edited.event';
import { StandardBomRegistered } from './events/standard-bom-registered.event';
import { Brand } from './value/brand.vo';
import { MiCode } from './value/mi-code.vo';
import { StandardBomComponentLine } from './value/standard-bom-component-line.vo';
import { StandardLength } from './value/standard-length.vo';

export class StandardBom extends AggregateRoot {
  private constructor(
    id: Identity,
    private _miCode: MiCode,
    private _brand: Brand,
    private _standardLength: StandardLength,
    private _active: boolean,
    private _description: string | undefined,
    private readonly _productId: Identity,
    private _components: StandardBomComponentLine[],
  ) {
    super(id);
  }

  public static register(
    miCode: MiCode,
    brand: Brand,
    standardLength: StandardLength,
    active: boolean,
    description: string | undefined,
    productId: Identity,
    components: StandardBomComponentLine[],
  ): StandardBom {
    StandardBom.assertHasAtLeastOneComponent(components);
    const standardBom = new StandardBom(
      Identity.new(),
      miCode,
      brand,
      standardLength,
      active,
      description,
      productId,
      components,
    );
    standardBom.recordThat(
      new StandardBomRegistered(
        standardBom.id.asString(),
        miCode.asString(),
        productId.asString(),
        components.map((component) => component.componentId().asString()),
      ),
    );
    return standardBom;
  }

  /**
   * Rehydrates a `StandardBom` from storage — for
   * `PrismaStandardBomRepository`'s `toDomain()` only. Unlike `register()`,
   * this records no event: loading an existing row is not a new business
   * fact.
   */
  public static fromPersistence(
    id: Identity,
    miCode: MiCode,
    brand: Brand,
    standardLength: StandardLength,
    active: boolean,
    description: string | undefined,
    productId: Identity,
    components: StandardBomComponentLine[],
  ): StandardBom {
    return new StandardBom(
      id,
      miCode,
      brand,
      standardLength,
      active,
      description,
      productId,
      components,
    );
  }

  /**
   * Updates the standard BOM's own scalar fields. The referenced product is
   * fixed at registration and cannot be changed through an edit — no
   * scenario requires it, and this keeps a standard BOM's composition
   * traceable to exactly one clone origin.
   */
  public edit(
    miCode: MiCode,
    brand: Brand,
    standardLength: StandardLength,
    description: string | undefined,
    active: boolean,
  ): void {
    this._miCode = miCode;
    this._brand = brand;
    this._standardLength = standardLength;
    this._description = description;
    this._active = active;
    this.recordThat(
      new StandardBomEdited(
        this.id.asString(),
        miCode.asString(),
        brand.asString(),
        standardLength.asNumber(),
        description,
        active,
      ),
    );
  }

  /**
   * Replaces the standard BOM's component composition wholesale, mirroring
   * `Product.updateComponents()`: there is no partial, line-by-line edit.
   */
  public updateComponents(components: StandardBomComponentLine[]): void {
    StandardBom.assertHasAtLeastOneComponent(components);
    this._components = components;
    this.recordThat(
      new StandardBomComponentsUpdated(
        this.id.asString(),
        components.map((component) => component.componentId().asString()),
      ),
    );
  }

  public delete(): void {
    this.recordThat(
      new StandardBomDeleted(this.id.asString(), this._miCode.asString()),
    );
  }

  public miCode(): MiCode {
    return this._miCode;
  }

  public brand(): Brand {
    return this._brand;
  }

  public standardLength(): StandardLength {
    return this._standardLength;
  }

  public active(): boolean {
    return this._active;
  }

  public description(): string | undefined {
    return this._description;
  }

  public productId(): Identity {
    return this._productId;
  }

  public components(): StandardBomComponentLine[] {
    return this._components;
  }

  private static assertHasAtLeastOneComponent(
    components: StandardBomComponentLine[],
  ): void {
    if (components.length === 0) {
      throw new Error('A standard BOM must have at least one component');
    }
  }
}
