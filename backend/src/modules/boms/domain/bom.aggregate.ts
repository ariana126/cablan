import { AggregateRoot, Identity } from '@framework/domain';

import {
  BomComponentSnapshot,
  BomCompositionReplacement,
  BomSnapshot,
} from './events/bom.snapshot';
import { BomApprovalRevoked } from './events/bom-approval-revoked.event';
import { BomApproved } from './events/bom-approved.event';
import { BomDeleted } from './events/bom-deleted.event';
import { BomEdited, BomFieldChange } from './events/bom-edited.event';
import { BomRegistered } from './events/bom-registered.event';
import { ApprovalStatus } from './value/approval-status';
import { BomApproval } from './value/bom-approval.vo';
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
    // استاندارد" without a live join back into `manufacturing-instructions` on every read.
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
    // Every BOM is registered unapproved; see `approve()`/`revokeApproval()`
    // and `edit()`, which voids an approval.
    private _approval: BomApproval,
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
      BomApproval.unapproved(),
    );
    bom.recordThat(new BomRegistered(bom.id.asString(), bom.snapshot()));
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
    approval: BomApproval,
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
      approval,
    );
  }

  /**
   * Updates the daily BOM's own scalar fields. The referenced standard BOM is
   * fixed at registration and cannot be changed through an edit — no
   * scenario requires it, and this keeps a daily BOM's composition traceable
   * to exactly one clone origin. The cloned reporting fields
   * (`standardBomMiCode`, `brand`, `productName`, `standardLength`,
   * `registeredBy`) are fixed at registration for the same reason.
   *
   * `components`, when given, replaces the component composition wholesale
   * (there is no partial, line-by-line edit) — in the same call, so one
   * edit records at most one `BomEdited` event however many parts of the
   * BOM it touches. A composition identical to the current one is not a
   * change, and an edit that changes nothing records no event at all.
   *
   * An edit that does change something sends an approved BOM back to
   * unapproved: after `BomEdited` (which carries only the edit's own
   * changes) it records a separate `BomApprovalRevoked`, exactly as a direct
   * revoke would, naming the BOM by its tracking number after the edit. An
   * edit rejected by a guard here (or before it ever reaches the aggregate)
   * leaves the approval as it was.
   */
  public edit(
    orderNumber: OrderNumber,
    trackingNumber: TrackingNumber,
    description: string | undefined,
    components?: BomComponentLine[],
  ): void {
    if (components !== undefined) {
      Bom.assertHasAtLeastOneComponent(components);
    }
    const changes: BomFieldChange[] = [];
    Bom.recordFieldChange(
      changes,
      'orderNumber',
      this._orderNumber.asString(),
      orderNumber.asString(),
    );
    Bom.recordFieldChange(
      changes,
      'trackingNumber',
      this._trackingNumber.asString(),
      trackingNumber.asString(),
    );
    Bom.recordFieldChange(
      changes,
      'description',
      this._description ?? '',
      description ?? '',
    );

    this._orderNumber = orderNumber;
    this._trackingNumber = trackingNumber;
    this._description = description;

    let replacedComposition: BomCompositionReplacement | null = null;
    if (
      components !== undefined &&
      !Bom.sameComposition(this._components, components)
    ) {
      replacedComposition = {
        previous: Bom.compositionSnapshotOf(this._components),
        current: Bom.compositionSnapshotOf(components),
      };
      this._components = components;
    }

    if (changes.length === 0 && replacedComposition === null) {
      return;
    }
    this.recordThat(
      new BomEdited(
        this.id.asString(),
        orderNumber.asString(),
        trackingNumber.asString(),
        description,
        changes,
        replacedComposition,
      ),
    );
    // An approval vouches for the BOM as it stood; any real change voids it,
    // recorded as its own revocation after the edit.
    this.revokeApproval();
  }

  /**
   * Approves the daily BOM as `approverName` (a display name, resolved by the
   * caller like `registeredBy`). Approving an already approved BOM is a
   * no-op: the original approver stands and no event is recorded.
   */
  public approve(approverName: string): void {
    if (this._approval.isApproved()) {
      return;
    }
    const approval = BomApproval.by(approverName);
    const changes = Bom.approvalChanges(this._approval, approval);
    this._approval = approval;
    this.recordThat(
      new BomApproved(
        this.id.asString(),
        approverName,
        this._trackingNumber.asString(),
        changes,
      ),
    );
  }

  /** Sends an approved BOM back to unapproved. A no-op if it is not approved. */
  public revokeApproval(): void {
    if (!this._approval.isApproved()) {
      return;
    }
    const unapproved = BomApproval.unapproved();
    const changes = Bom.approvalChanges(this._approval, unapproved);
    this._approval = unapproved;
    this.recordThat(
      new BomApprovalRevoked(
        this.id.asString(),
        this._trackingNumber.asString(),
        changes,
      ),
    );
  }

  public delete(): void {
    this.recordThat(new BomDeleted(this.id.asString(), this.snapshot()));
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

  public approvalStatus(): ApprovalStatus {
    return this._approval.status();
  }

  public approvedBy(): string | null {
    return this._approval.approvedBy();
  }

  private snapshot(): BomSnapshot {
    return {
      standardBomId: this._standardBomId.asString(),
      standardBomMiCode: this._standardBomMiCode,
      brand: this._brand,
      productName: this._productName,
      standardLength: this._standardLength,
      orderNumber: this._orderNumber.asString(),
      trackingNumber: this._trackingNumber.asString(),
      description: this._description,
      registeredBy: this._registeredBy,
      components: Bom.compositionSnapshotOf(this._components),
    };
  }

  private static compositionSnapshotOf(
    components: BomComponentLine[],
  ): BomComponentSnapshot[] {
    return components.map((component) => ({
      name: component.name(),
      materials: component.materials().map((material) => ({
        name: material.name(),
        weightInGrams: material.weight().asGrams(),
      })),
    }));
  }

  private static assertHasAtLeastOneComponent(
    components: BomComponentLine[],
  ): void {
    if (components.length === 0) {
      throw new Error('A BOM must have at least one component');
    }
  }

  private static sameComposition(
    current: BomComponentLine[],
    next: BomComponentLine[],
  ): boolean {
    return (
      current.length === next.length &&
      current.every((line, index) => line.equals(next[index]))
    );
  }

  /**
   * The two change lines describing a move between approvals: the status,
   * then the approver. A change line carries strings only, so "no approver"
   * is `''` — the same sentinel `description` uses when absent.
   */
  private static approvalChanges(
    previous: BomApproval,
    next: BomApproval,
  ): BomFieldChange[] {
    return [
      {
        field: 'approvalStatus',
        previousValue: previous.status(),
        newValue: next.status(),
      },
      {
        field: 'approvedBy',
        previousValue: previous.approvedBy() ?? '',
        newValue: next.approvedBy() ?? '',
      },
    ];
  }

  /**
   * Appends a `BomFieldChange` only when `previousValue` and `newValue`
   * actually differ — a field resent unchanged (the common case, since
   * `EditBomHandler` always passes every field's *resolved* value, changed
   * or not) never appears in `BomEdited.changes`.
   */
  private static recordFieldChange(
    changes: BomFieldChange[],
    field: string,
    previousValue: string,
    newValue: string,
  ): void {
    if (previousValue !== newValue) {
      changes.push({ field, previousValue, newValue });
    }
  }
}
