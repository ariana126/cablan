import { BomEditRecord } from '@boms/domain/value/bom-edit-record.vo';

// One record of a daily BOM's edit details («جزئیات ویرایش»), as the daily
// BOMs page, the BOM detail and the dashboard all show it: `heading` (who,
// when — Jalali, in Tehran — and why), then `changes`, one line each. The
// heading is rendered here, by the same `BomEditRecord` that renders a review
// edit's block of the management note, so the two can never disagree; a
// client never formats the date itself. `editedAt` is the ISO instant.
export class BomEditRecordItem {
  constructor(
    public readonly editedBy: string,
    public readonly editedAt: string,
    public readonly reason: string,
    public readonly heading: string,
    public readonly changes: string[],
  ) {}

  static of(record: BomEditRecord): BomEditRecordItem {
    return new BomEditRecordItem(
      record.editedBy(),
      record.editedAt().toISOString(),
      record.reason(),
      record.heading(),
      [...record.changes()],
    );
  }
}

/** A BOM's edit details, oldest first. */
export function editHistoryItemsOf(
  records: readonly BomEditRecord[],
): BomEditRecordItem[] {
  return records.map((record) => BomEditRecordItem.of(record));
}
