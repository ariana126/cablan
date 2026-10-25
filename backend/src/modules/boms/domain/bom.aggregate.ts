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
import { RejectionReasonRequired } from './exceptions/rejection-reason-required.exception';
import { ApprovalStatus } from './value/approval-status';
import { BomComponentLine } from './value/bom-component-line.vo';
import { BomEditor } from './value/bom-editor.vo';
import { BomReview } from './value/bom-review.vo';
import { OrderNumber } from './value/order-number.vo';
import {
  PendingReviewChanges,
  ReviewChange,
  ReviewedField,
  ReviewedMaterialChange,
} from './value/pending-review-changes.vo';
import { TrackingNumber } from './value/tracking-number.vo';

// One material line of a composition, as `materialChangesBetween()` pairs
// them: what a review change names it by, and its weight.
// A change line `edit()` records for one of its own scalar fields — every
// one of which a review notes, so the field is a `ReviewedField`, checked by
// the compiler rather than cast.
type EditedFieldChange = BomFieldChange & { readonly field: ReviewedField };

interface MaterialLineEntry {
  readonly line: Omit<ReviewedMaterialChange, 'previousWeight' | 'newWeight'>;
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
    // The edits by any reviewer during the current review — what `approve()`
    // records as the management note. See `edit()`.
    private _pendingReviewChanges: PendingReviewChanges,
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
      PendingReviewChanges.none(),
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
    pendingReviewChanges: PendingReviewChanges,
  ): Bom {
    // Approving or rejecting ends a review and discards its notes, so only a
    // pending BOM can hold any — the same consistency check
    // `BomReview.restore()` makes of the review itself.
    if (!review.isPending() && !pendingReviewChanges.isEmpty()) {
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
      pendingReviewChanges,
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
   * An edit that does change something sends an approved or rejected BOM
   * back to pending: after `BomEdited` (which carries only the edit's own
   * changes) it records a separate `BomReturnedToPending`, naming the BOM by
   * its tracking number after the edit. An edit rejected by a guard here (or
   * before it ever reaches the aggregate) leaves the review as it was.
   *
   * `editor` says whether whoever edits may review daily BOMs (approve or
   * reject them). An edit by any reviewer is folded into the pending review
   * changes approving will note; anyone else's edit discards them, since the
   * BOM a reviewer would approve is then no longer only what reviewers made
   * it. An edit that changes nothing leaves them as they are.
   */
  public edit(
    orderNumber: OrderNumber,
    trackingNumber: TrackingNumber,
    typedDescription: string | undefined,
    components: BomComponentLine[] | undefined,
    editor: BomEditor,
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

    this._orderNumber = orderNumber;
    this._trackingNumber = trackingNumber;
    this._description = description;

    let replacedComposition: BomCompositionReplacement | null = null;
    let materialChanges: ReviewedMaterialChange[] = [];
    if (
      components !== undefined &&
      !Bom.sameComposition(this._components, components)
    ) {
      replacedComposition = {
        previous: Bom.compositionSnapshotOf(this._components),
        current: Bom.compositionSnapshotOf(components),
      };
      materialChanges = Bom.materialChangesBetween(
        this._components,
        components,
      );
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
    // A review vouches for the BOM as it stood; any real change sends it
    // back to pending, recorded as its own event after the edit.
    if (!this._review.isPending()) {
      this.returnToPending();
    }
    // After the return to pending, which ends the previous review: a
    // reviewer's edit of a reviewed BOM is the first of the next review.
    this._pendingReviewChanges = editor.isReviewer()
      ? this._pendingReviewChanges.mergedWith(
          [...Bom.reviewedFieldChanges(changes), ...materialChanges],
          this._components,
        )
      : PendingReviewChanges.none();
  }

  /**
   * Approves a pending daily BOM as `reviewerName` (a display name, resolved
   * by the caller like `registeredBy`). The edits by any reviewer during this
   * review become the management note — no edits, no note — and are then
   * discarded. An approved or rejected BOM cannot be approved: it must be
   * edited back to pending first.
   */
  public approve(reviewerName: string): void {
    this.assertPending();
    const approval = BomReview.approvedBy(
      reviewerName,
      this._pendingReviewChanges.asManagementNote(),
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
   * its management note; the edits by any reviewer during this review
   * are discarded, not noted. A missing, empty or whitespace-only reason is
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

  public pendingReviewChanges(): PendingReviewChanges {
    return this._pendingReviewChanges;
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
    this._pendingReviewChanges = PendingReviewChanges.none();
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

  // An edit's own field lines as review changes.
  private static reviewedFieldChanges(
    changes: EditedFieldChange[],
  ): ReviewChange[] {
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
  ): ReviewedMaterialChange[] {
    const previousLines = Bom.materialLinesOf(previous);
    const nextLines = Bom.materialLinesOf(next);
    const changes: ReviewedMaterialChange[] = [];
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
