import { toAsciiDigits, ValueObject } from '@framework/domain';

import { EditReasonRequired } from '../exceptions/edit-reason-required.exception';
import { BomEditRecord } from './bom-edit-record.vo';
import { BomEditSource } from './bom-edit-source';
import { BomEditor } from './bom-editor.vo';

/**
 * The circumstances of one edit of a daily BOM, as `Bom.edit()` needs them:
 * who is editing (their display name, and whether they may review), where
 * from, why, and when.
 *
 * An edit is a **review edit** exactly when a reviewer makes it from the
 * dashboard; every other edit — a reviewer's on the daily BOMs page, or
 * anyone else's anywhere — is a **correction**. A non-reviewer claiming the
 * dashboard is not refused, only treated as a correction.
 */
export class BomEditContext extends ValueObject {
  private constructor(
    private readonly _editedBy: string,
    private readonly _isReviewer: boolean,
    private readonly _source: BomEditSource,
    // Trimmed and digit-normalised like the description; `''` when none.
    private readonly _reason: string,
    private readonly _editedAt: Date,
  ) {
    super();
  }

  static of(
    editedBy: string,
    editor: BomEditor,
    source: BomEditSource,
    reason: string | undefined,
    editedAt: Date,
  ): BomEditContext {
    return new BomEditContext(
      editedBy,
      editor.isReviewer(),
      source,
      toAsciiDigits(reason ?? '').trim(),
      new Date(editedAt),
    );
  }

  public isReviewEdit(): boolean {
    return this._isReviewer && this._source === BomEditSource.Dashboard;
  }

  /**
   * The record of this edit's `changes` (its change lines). An edit that
   * changes something must say why: with no reason this throws
   * `EditReasonRequired`, so `Bom.edit()` asks for the record before it
   * touches anything.
   */
  public recordOf(changes: readonly string[]): BomEditRecord {
    if (this._reason === '') {
      throw EditReasonRequired.create();
    }
    return BomEditRecord.of(
      this._editedBy,
      this._editedAt,
      this._reason,
      changes,
    );
  }
}
