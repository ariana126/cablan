import { AggregateRoot, Identity } from '@framework/domain';

import { BomComponentsUpdated } from './events/bom-components-updated.event';
import { BomDeleted } from './events/bom-deleted.event';
import { BomEdited } from './events/bom-edited.event';
import { BomRegistered } from './events/bom-registered.event';
import { BomComponentLine } from './value/bom-component-line.vo';
import { OrderNumber } from './value/order-number.vo';
import { TrackingNumber } from './value/tracking-number.vo';

export class Bom extends AggregateRoot {
  private constructor(
    id: Identity,
    private readonly _standardBomId: Identity,
    // Cloned from the referenced standard BOM at registration, exactly like
    // `_standardBomId` itself — immutable afterwards, since the referenced
    // standard BOM cannot be changed through an edit (see `edit()`'s doc
    // comment). Lets a report show "کد MI"/"برند"/"نام محصول"/"متراژ
    // استاندارد" without a live join back into `standard-boms` on every read.
    private readonly _standardBomMiCode: string,
    private readonly _brand: string,
    private readonly _productName: string,
    private readonly _standardLength: number,
    private _orderNumber: OrderNumber,
    private _trackingNumber: TrackingNumber,
    private _description: string | undefined,
    // The acting user's display name at registration, resolved by
    // `BomController.register()` through `DisplayNameProvider` — a clone, not a
    // reference to the user record, so a later rename never rewrites who a
    // report says registered this BOM. Immutable afterwards; no scenario
    // edits it.
    private readonly _registeredBy: string,
    private _components: BomComponentLine[],
  ) {
    super(id);
  }

  public static register(
    standardBomId: Identity,
    standardBomMiCode: string,
    brand: string,
    productName: string,
    standardLength: number,
    orderNumber: OrderNumber,
    trackingNumber: TrackingNumber,
    description: string | undefined,
    registeredBy: string,
    components: BomComponentLine[],
  ): Bom {
    Bom.assertHasAtLeastOneComponent(components);
    const bom = new Bom(
      Identity.new(),
      standardBomId,
      standardBomMiCode,
      brand,
      productName,
      standardLength,
      orderNumber,
      trackingNumber,
      description,
      registeredBy,
      components,
    );
    bom.recordThat(
      new BomRegistered(
        bom.id.asString(),
        standardBomId.asString(),
        orderNumber.asString(),
        trackingNumber.asString(),
        components.map((component) => component.componentId().asString()),
      ),
    );
    return bom;
  }

  /**
   * Rehydrates a `Bom` from storage — for `PrismaBomRepository`'s
   * `toDomain()` only. Unlike `register()`, this records no event: loading
   * an existing row is not a new business fact.
   */
  public static fromPersistence(
    id: Identity,
    standardBomId: Identity,
    standardBomMiCode: string,
    brand: string,
    productName: string,
    standardLength: number,
    orderNumber: OrderNumber,
    trackingNumber: TrackingNumber,
    description: string | undefined,
    registeredBy: string,
    components: BomComponentLine[],
  ): Bom {
    return new Bom(
      id,
      standardBomId,
      standardBomMiCode,
      brand,
      productName,
      standardLength,
      orderNumber,
      trackingNumber,
      description,
      registeredBy,
      components,
    );
  }

  /**
   * Updates the daily BOM's own scalar fields. The referenced standard BOM is
   * fixed at registration and cannot be changed through an edit — no
   * scenario requires it, and this keeps a daily BOM's composition traceable
   * to exactly one clone origin. The cloned reporting fields
   * (`standardBomMiCode`, `brand`, `productName`, `standardLength`,
   * `registeredBy`) are fixed at registration for the same reason.
   */
  public edit(
    orderNumber: OrderNumber,
    trackingNumber: TrackingNumber,
    description: string | undefined,
  ): void {
    this._orderNumber = orderNumber;
    this._trackingNumber = trackingNumber;
    this._description = description;
    this.recordThat(
      new BomEdited(
        this.id.asString(),
        orderNumber.asString(),
        trackingNumber.asString(),
        description,
      ),
    );
  }

  /**
   * Replaces the daily BOM's component composition wholesale, mirroring
   * `StandardBom.updateComponents()`: there is no partial, line-by-line edit.
   */
  public updateComponents(components: BomComponentLine[]): void {
    Bom.assertHasAtLeastOneComponent(components);
    this._components = components;
    this.recordThat(
      new BomComponentsUpdated(
        this.id.asString(),
        components.map((component) => component.componentId().asString()),
      ),
    );
  }

  public delete(): void {
    this.recordThat(
      new BomDeleted(this.id.asString(), this._orderNumber.asString()),
    );
  }

  public standardBomId(): Identity {
    return this._standardBomId;
  }

  public standardBomMiCode(): string {
    return this._standardBomMiCode;
  }

  public brand(): string {
    return this._brand;
  }

  public productName(): string {
    return this._productName;
  }

  public standardLength(): number {
    return this._standardLength;
  }

  public orderNumber(): OrderNumber {
    return this._orderNumber;
  }

  public trackingNumber(): TrackingNumber {
    return this._trackingNumber;
  }

  public description(): string | undefined {
    return this._description;
  }

  public registeredBy(): string {
    return this._registeredBy;
  }

  public components(): BomComponentLine[] {
    return this._components;
  }

  private static assertHasAtLeastOneComponent(
    components: BomComponentLine[],
  ): void {
    if (components.length === 0) {
      throw new Error('A BOM must have at least one component');
    }
  }
}
