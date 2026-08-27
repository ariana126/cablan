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
    private _orderNumber: OrderNumber,
    private _trackingNumber: TrackingNumber,
    private _description: string | undefined,
    private _components: BomComponentLine[],
  ) {
    super(id);
  }

  public static register(
    standardBomId: Identity,
    orderNumber: OrderNumber,
    trackingNumber: TrackingNumber,
    description: string | undefined,
    components: BomComponentLine[],
  ): Bom {
    Bom.assertHasAtLeastOneComponent(components);
    const bom = new Bom(
      Identity.new(),
      standardBomId,
      orderNumber,
      trackingNumber,
      description,
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
    orderNumber: OrderNumber,
    trackingNumber: TrackingNumber,
    description: string | undefined,
    components: BomComponentLine[],
  ): Bom {
    return new Bom(
      id,
      standardBomId,
      orderNumber,
      trackingNumber,
      description,
      components,
    );
  }

  /**
   * Updates the daily BOM's own scalar fields. The referenced standard BOM is
   * fixed at registration and cannot be changed through an edit — no
   * scenario requires it, and this keeps a daily BOM's composition traceable
   * to exactly one clone origin.
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

  public orderNumber(): OrderNumber {
    return this._orderNumber;
  }

  public trackingNumber(): TrackingNumber {
    return this._trackingNumber;
  }

  public description(): string | undefined {
    return this._description;
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
