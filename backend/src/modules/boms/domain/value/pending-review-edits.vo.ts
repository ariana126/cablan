import { ValueObject } from '@framework/domain';

import { BomEditRecord } from './bom-edit-record.vo';

/**
 * The review edits of a daily BOM's current review — edits a reviewer made
 * from the dashboard — which approving it records as the management note
 * («توضیحات مدیریت»). Kept between the edit request and the approve request
 * (stored in `bom.pending_review_changes`).
 *
 * The note is one block per review edit, in the order they were made: its
 * heading (who, when, why), then its change lines. Edits are never merged —
 * with a reason and a time per edit, folding two into one line would lose
 * whose reason it was.
 */
export class PendingReviewEdits extends ValueObject {
  private constructor(private readonly _edits: readonly BomEditRecord[]) {
    super();
  }

  static none(): PendingReviewEdits {
    return new PendingReviewEdits([]);
  }

  // For rehydrating stored review edits (`BomMapper`).
  static restore(edits: readonly BomEditRecord[]): PendingReviewEdits {
    return new PendingReviewEdits([...edits]);
  }

  /** These review edits with `edit` appended. */
  public withEdit(edit: BomEditRecord): PendingReviewEdits {
    return new PendingReviewEdits([...this._edits, edit]);
  }

  public isEmpty(): boolean {
    return this._edits.length === 0;
  }

  /** Every edit's lines, joined by newlines; `null` when there are none. */
  public asManagementNote(): string | null {
    if (this.isEmpty()) {
      return null;
    }
    return this._edits.flatMap((edit) => edit.lines()).join('\n');
  }

  public edits(): readonly BomEditRecord[] {
    return this._edits;
  }
}
