import { jalaliDateAndTime, ValueObject } from '@framework/domain';

// The plant's zone: a heading is a stored record of when the plant saw the
// edit, so it is read in Tehran whoever reads it later, wherever they are.
const HEADING_TIME_ZONE = 'Asia/Tehran';

/**
 * One effective edit of a daily BOM, as a person reads it: who made it
 * (`editedBy`, a display name), when, why, and one Persian line per change
 * (`changeLineOf`). A correction keeps one in the BOM's edit details
 * («جزئیات ویرایش»); a review edit keeps one until the review ends, and it
 * then becomes a block of the management note («توضیحات مدیریت»).
 */
export class BomEditRecord extends ValueObject {
  private constructor(
    private readonly _editedBy: string,
    private readonly _editedAt: Date,
    private readonly _reason: string,
    private readonly _changes: readonly string[],
  ) {
    super();
  }

  /**
   * An edit that is recorded changed something, and always says why — a
   * blank reason is refused before a record is made (`BomEditContext`), so
   * either of these failing is a programming mistake.
   */
  static of(
    editedBy: string,
    editedAt: Date,
    reason: string,
    changes: readonly string[],
  ): BomEditRecord {
    if (reason.trim() === '') {
      throw new Error('A daily BOM edit is recorded with its reason');
    }
    if (changes.length === 0) {
      throw new Error('A daily BOM edit is recorded with at least one change');
    }
    return new BomEditRecord(editedBy, new Date(editedAt), reason, [
      ...changes,
    ]);
  }

  public editedBy(): string {
    return this._editedBy;
  }

  public editedAt(): Date {
    return new Date(this._editedAt);
  }

  public reason(): string {
    return this._reason;
  }

  public changes(): readonly string[] {
    return this._changes;
  }

  /** «کاربر … در yyyy/MM/dd ساعت HH:mm به علت … تغییرات زیر را انجام داد», Jalali, in Tehran. */
  public heading(): string {
    const { date, time } = jalaliDateAndTime(this._editedAt, HEADING_TIME_ZONE);
    return `کاربر ${this._editedBy} در ${date} ساعت ${time} به علت ${this._reason} تغییرات زیر را انجام داد`;
  }

  /** The heading, then each change line. */
  public lines(): string[] {
    return [this.heading(), ...this._changes];
  }
}
