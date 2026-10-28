import { AggregateRoot, Identity, toAsciiDigits } from '@framework/domain';

import {
  BomComponentSnapshot,
  BomCompositionReplacement,
  BomSnapshot,
} from './events/bom.snapshot';
import { BomApproved } from './events/bom-approved.event';
import { BomDeleted } from './events/bom-deleted.event';
import { BomEdited, BomFieldChange } from './events/bom-edited.event';
import { BomRegistered } from './events/bom-registered.event';
import { BomRejected } from './events/bom-rejected.event';
import { BomReturnedToPending } from './events/bom-returned-to-pending.event';
import { BomAlreadyReviewed } from './exceptions/bom-already-reviewed.exception';
import { BomNotResamplable } from './exceptions/bom-not-resamplable.exception';
import { RejectionReasonRequired } from './exceptions/rejection-reason-required.exception';
import { resamplingRefusal } from './service/resampling.policy';
import { ApprovalStatus } from './value/approval-status';
import { BomComponentLine } from './value/bom-component-line.vo';
import {
  BomEditChange,
  changeLineOf,
  EditedField,
  MaterialEditChange,
} from './value/bom-edit-change';
import { BomEditContext } from './value/bom-edit-context.vo';
import { BomEditRecord } from './value/bom-edit-record.vo';
import { BomReview } from './value/bom-review.vo';
import { OrderNumber } from './value/order-number.vo';
import { PendingReviewEdits } from './value/pending-review-edits.vo';
import { TrackingNumber } from './value/tracking-number.vo';

// A change line `edit()` records for one of its own scalar fields — every
// one of which an edit's record describes, so the field is an `EditedField`,
// checked by the compiler rather than cast.
type EditedFieldChange = BomFieldChange & { readonly field: EditedField };

// One material line of a composition, as `materialChangesBetween()` pairs
// them: what a change names it by, and its weight.
interface MaterialLineEntry {
  readonly line: Omit<MaterialEditChange, 'previousWeight' | 'newWeight'>;
  readonly weight: number;
}

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
    // Every BOM is registered pending; see `approve()`/`reject()` and
    // `edit()`, which sends a reviewed BOM back to pending.
    private _review: BomReview,
    // The review edits of the current review — what `approve()` records as
    // the management note. See `edit()`.
    private _pendingReviewEdits: PendingReviewEdits,
    // The edit details («جزئیات ویرایش»): one record per effective
    // correction, oldest first, never discarded. See `edit()`.
    private _editHistory: readonly BomEditRecord[],
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
      Bom.normalisedDescription(description),
      registeredBy,
      components,
      BomReview.pending(),
      PendingReviewEdits.none(),
      [],
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
    review: BomReview,
    pendingReviewEdits: PendingReviewEdits,
    editHistory: readonly BomEditRecord[],
  ): Bom {
    // Approving or rejecting ends a review and discards its notes, so only a
    // pending BOM can hold any — the same consistency check
    // `BomReview.restore()` makes of the review itself.
    if (!review.isPending() && !pendingReviewEdits.isEmpty()) {
      throw new Error(
        'A reviewed daily BOM cannot hold pending review changes',
      );
    }
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
      review,
      pendingReviewEdits,
      [...editHistory],
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
   * BOM it touches. An edit is effective exactly when it has a change line
   * to show: one that changes nothing — including a composition that differs
   * only in re-cloned names or line order, which is adopted quietly — records
   * no event at all, needs no reason and leaves the review as it was.
   *
   * An edit that does change something must say why (`context`'s reason):
   * without one it is refused as `EditReasonRequired` before anything is
   * touched. It then sends an approved or rejected BOM back to pending:
   * after `BomEdited` (which carries only the edit's own changes) it records
   * a separate `BomReturnedToPending`, naming the BOM by its tracking number
   * after the edit.
   *
   * The edit is described as one record — who, when, why, and a line per
   * change (scalar fields first, then material lines in the new
   * composition's order, removed lines last). A review edit (a reviewer, from
   * the dashboard) is appended to the pending review changes approving will
   * note; a correction (every other edit) to the edit details. Neither ever
   * enters the other, and a correction leaves the pending review changes
   * alone.
   */
  public edit(
    orderNumber: OrderNumber,
    trackingNumber: TrackingNumber,
    typedDescription: string | undefined,
    components: BomComponentLine[] | undefined,
    context: BomEditContext,
  ): void {
    if (components !== undefined) {
      Bom.assertHasAtLeastOneComponent(components);
    }
    const description = Bom.normalisedDescription(typedDescription);
    const changes: EditedFieldChange[] = [];
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
    const replacedComponents =
      components !== undefined &&
      !Bom.sameComposition(this._components, components)
        ? components
        : null;
    const changeLines = [
      ...Bom.editChangesOf(changes),
      ...(replacedComponents === null
        ? []
        : Bom.materialChangesBetween(this._components, replacedComponents)),
    ].map((change) => changeLineOf(change));

    // The change lines are the one test of an effective edit. A composition
    // that differs only in what was re-cloned — names renamed upstream, or
    // the line order — has none: it is adopted quietly, and is no edit.
    if (changeLines.length === 0) {
      if (replacedComponents !== null) {
        this._components = replacedComponents;
      }
      return;
    }
    // Before anything is touched: a refused edit changes nothing.
    const record = context.recordOf(changeLines);

    let replacedComposition: BomCompositionReplacement | null = null;
    if (replacedComponents !== null) {
      replacedComposition = {
        previous: Bom.compositionSnapshotOf(this._components),
        current: Bom.compositionSnapshotOf(replacedComponents),
      };
      this._components = replacedComponents;
    }
    this._orderNumber = orderNumber;
    this._trackingNumber = trackingNumber;
    this._description = description;

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
    // A review vouches for the BOM as it stood; any real change sends it
    // back to pending, recorded as its own event after the edit.
    if (!this._review.isPending()) {
      this.returnToPending();
    }
    // After the return to pending, which ends the previous review: a review
    // edit of a reviewed BOM is the first of the next review.
    if (context.isReviewEdit()) {
      this._pendingReviewEdits = this._pendingReviewEdits.withEdit(record);
    } else {
      this._editHistory = [...this._editHistory, record];
    }
  }

  /**
   * Approves a pending daily BOM as `reviewerName` (a display name, resolved
   * by the caller like `registeredBy`). The review edits of this review
   * become the management note — no edits, no note — and are then
   * discarded. An approved or rejected BOM cannot be approved: it must be
   * edited back to pending first.
   */
  public approve(reviewerName: string): void {
    this.assertPending();
    const approval = BomReview.approvedBy(
      reviewerName,
      this._pendingReviewEdits.asManagementNote(),
    );
    const reviewChanges = this.moveTo(approval);
    this.recordThat(
      new BomApproved(
        this.id.asString(),
        reviewerName,
        approval.managementNote(),
        this._trackingNumber.asString(),
        reviewChanges,
      ),
    );
  }

  /**
   * Rejects a pending daily BOM as `reviewerName`, with `reason` (trimmed) as
   * its management note; the review edits of this review are discarded, not
   * noted. A missing, empty or whitespace-only reason is
   * refused, as is rejecting a BOM that is not pending.
   */
  public reject(reviewerName: string, reason: string): void {
    const trimmedReason = reason.trim();
    if (!trimmedReason) {
      throw RejectionReasonRequired.create();
    }
    this.assertPending();
    const reviewChanges = this.moveTo(
      BomReview.rejectedBy(reviewerName, trimmedReason),
    );
    this.recordThat(
      new BomRejected(
        this.id.asString(),
        reviewerName,
        trimmedReason,
        this._trackingNumber.asString(),
        reviewChanges,
      ),
    );
  }

  /**
   * Re-samples («نمونه گیری مجدد») this daily BOM: registers a new, ordinary
   * one — pending, `BomRegistered` — for the same work order, with this one's
   * order number, tracking number and MI code, and the new sample's
   * composition (cloned from that MI code's standard BOM by the caller),
   * description and registrant. Only the latest daily BOM of its tracking
   * number can be re-sampled, once rejected (`resamplingRefusal`);
   * `isLatestOfTrackingNumber` is the repository's answer, since "latest"
   * depends on the other BOMs. This BOM itself is not changed and records
   * nothing, and nothing links the two.
   */
  public resample(
    isLatestOfTrackingNumber: boolean,
    standardBomId: Identity,
    brand: string,
    productName: string,
    standardLength: number,
    components: BomComponentLine[],
    description: string | undefined,
    registeredBy: string,
  ): Bom {
    const refusal = resamplingRefusal(
      this.approvalStatus(),
      isLatestOfTrackingNumber,
    );
    if (refusal !== null) {
      throw BomNotResamplable.because(
        refusal,
        this.id.asString(),
        this.approvalStatus(),
      );
    }
    return Bom.register(
      standardBomId,
      this._standardBomMiCode,
      brand,
      productName,
      standardLength,
      this._orderNumber,
      this._trackingNumber,
      description,
      registeredBy,
      components,
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
    return this._review.status();
  }

  public reviewedBy(): string | null {
    return this._review.reviewedBy();
  }

  public managementNote(): string | null {
    return this._review.managementNote();
  }

  public pendingReviewEdits(): PendingReviewEdits {
    return this._pendingReviewEdits;
  }

  public editHistory(): readonly BomEditRecord[] {
    return this._editHistory;
  }

  private returnToPending(): void {
    const reviewChanges = this.moveTo(BomReview.pending());
    this.recordThat(
      new BomReturnedToPending(
        this.id.asString(),
        this._trackingNumber.asString(),
        reviewChanges,
      ),
    );
  }

  private assertPending(): void {
    if (!this._review.isPending()) {
      throw BomAlreadyReviewed.withStatus(
        this.id.asString(),
        this._review.status(),
      );
    }
  }

  /**
   * Moves to the `next` review, discarding the pending review changes (a
   * review ends with every move), and returns the change lines describing
   * the move: the status, the reviewer, then the management note when it
   * differs. A change line carries strings only, so "no reviewer"/"no note"
   * is `''` — the same sentinel `description` uses when absent.
   */
  private moveTo(next: BomReview): BomFieldChange[] {
    const previous = this._review;
    const reviewChanges: BomFieldChange[] = [
      {
        field: 'approvalStatus',
        previousValue: previous.status(),
        newValue: next.status(),
      },
      {
        field: 'reviewedBy',
        previousValue: previous.reviewedBy() ?? '',
        newValue: next.reviewedBy() ?? '',
      },
    ];
    Bom.recordFieldChange(
      reviewChanges,
      'managementNote',
      previous.managementNote() ?? '',
      next.managementNote() ?? '',
    );
    this._review = next;
    this._pendingReviewEdits = PendingReviewEdits.none();
    return reviewChanges;
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

  // An edit's own field lines as edit changes.
  private static editChangesOf(changes: EditedFieldChange[]): BomEditChange[] {
    return changes.map((change) => ({
      kind: 'field',
      field: change.field,
      previousValue: change.previousValue,
      newValue: change.newValue,
    }));
  }

  /**
   * Each material line whose weight differs between two compositions — in
   * `next`'s order, then the lines `next` no longer has — with `null` on the
   * side a line is missing from. Lines are paired by their cloned component
   * and material ids.
   */
  private static materialChangesBetween(
    previous: BomComponentLine[],
    next: BomComponentLine[],
  ): MaterialEditChange[] {
    const previousLines = Bom.materialLinesOf(previous);
    const nextLines = Bom.materialLinesOf(next);
    const changes: MaterialEditChange[] = [];
    for (const [key, { line, weight }] of nextLines) {
      const previousWeight = previousLines.get(key)?.weight ?? null;
      if (previousWeight !== weight) {
        changes.push({ ...line, previousWeight, newWeight: weight });
      }
    }
    for (const [key, { line, weight }] of previousLines) {
      if (!nextLines.has(key)) {
        changes.push({ ...line, previousWeight: weight, newWeight: null });
      }
    }
    return changes;
  }

  private static materialLinesOf(
    components: BomComponentLine[],
  ): Map<string, MaterialLineEntry> {
    const lines = new Map<string, MaterialLineEntry>();
    for (const component of components) {
      const componentId = component.componentId().asString();
      for (const material of component.materials()) {
        const materialId = material.materialId().asString();
        lines.set(`${componentId}:${materialId}`, {
          line: {
            kind: 'material',
            componentId,
            componentName: component.name(),
            materialId,
            materialName: material.name(),
          },
          weight: material.weight().asGrams(),
        });
      }
    }
    return lines;
  }

  /**
   * The description as stored: digits typed on a Persian keyboard become
   * English ones, like the order and tracking numbers' own value objects.
   * Free text with no invariant of its own, so it has no value object.
   */
  private static normalisedDescription(
    description: string | undefined,
  ): string | undefined {
    return description === undefined ? undefined : toAsciiDigits(description);
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
   * Appends a `BomFieldChange` only when `previousValue` and `newValue`
   * actually differ — a field resent unchanged (the common case, since
   * `EditBomHandler` always passes every field's *resolved* value, changed
   * or not) never appears in `BomEdited.changes`.
   */
  private static recordFieldChange<Field extends string>(
    changes: (BomFieldChange & { readonly field: Field })[],
    field: Field,
    previousValue: string,
    newValue: string,
  ): void {
    if (previousValue !== newValue) {
      changes.push({ field, previousValue, newValue });
    }
  }
}
