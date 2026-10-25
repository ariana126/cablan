import { ValueObject } from '@framework/domain';

import { ApprovalStatus } from './approval-status';

// A daily BOM's review: its status, who reviewed it and the management note
// ("توضیحات مدیریت"). The three travel together because they are one fact:
// - pending: no reviewer, no note;
// - approved: a reviewer, and a note only if the reviewer edited the BOM
//   while reviewing it;
// - rejected: a reviewer and a non-blank note — the reason for rejecting.
// `reviewedBy` is the reviewer's display name at the moment of review, cloned
// like `Bom.registeredBy()` — a later rename never rewrites who reviewed it.
export class BomReview extends ValueObject {
  private constructor(
    private readonly _status: ApprovalStatus,
    private readonly _reviewedBy: string | null,
    private readonly _managementNote: string | null,
  ) {
    super();
  }

  static pending(): BomReview {
    return new BomReview(ApprovalStatus.Pending, null, null);
  }

  static approvedBy(
    reviewerName: string,
    managementNote: string | null,
  ): BomReview {
    BomReview.assertNamesReviewer(reviewerName);
    return new BomReview(ApprovalStatus.Approved, reviewerName, managementNote);
  }

  static rejectedBy(reviewerName: string, reason: string): BomReview {
    BomReview.assertNamesReviewer(reviewerName);
    if (!reason.trim()) {
      throw new Error('A rejection must state its reason');
    }
    return new BomReview(ApprovalStatus.Rejected, reviewerName, reason);
  }

  // For rehydrating a stored review (`BomMapper`) — checks the stored triple
  // still states one consistent fact.
  static restore(
    status: ApprovalStatus,
    reviewedBy: string | null,
    managementNote: string | null,
  ): BomReview {
    if (status === ApprovalStatus.Pending) {
      if (reviewedBy !== null || managementNote !== null) {
        throw new Error(
          'A pending BOM can have neither a reviewer nor a management note',
        );
      }
      return BomReview.pending();
    }
    if (reviewedBy === null) {
      throw new Error('A reviewed BOM must name its reviewer');
    }
    if (status === ApprovalStatus.Approved) {
      return BomReview.approvedBy(reviewedBy, managementNote);
    }
    return BomReview.rejectedBy(reviewedBy, managementNote ?? '');
  }

  private static assertNamesReviewer(reviewerName: string): void {
    if (!reviewerName.trim()) {
      throw new Error('A review must name its reviewer');
    }
  }

  public isPending(): boolean {
    return this._status === ApprovalStatus.Pending;
  }

  public status(): ApprovalStatus {
    return this._status;
  }

  public reviewedBy(): string | null {
    return this._reviewedBy;
  }

  public managementNote(): string | null {
    return this._managementNote;
  }
}
