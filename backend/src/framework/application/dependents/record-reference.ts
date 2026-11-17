/**
 * The record types another record can reference — and that therefore can be
 * locked against edit and delete while referenced (issue #94). The values are
 * also the wire's `recordType`, so they keep the audit log's record-type
 * names — all but `order` (issue #101) and `qc-activity` (issue #119), whose
 * lower-case values are the ones their HTTP contracts pinned (their audit
 * record types are `Order` and `QcActivity`).
 */
export type ReferencedRecordType =
  | 'Material'
  | 'Component'
  | 'Product'
  | 'StandardBom'
  | 'Bom'
  | 'Equipment'
  | 'MaintenanceActivity'
  | 'order'
  | 'qc-activity';

/** "This record": its type and its id. */
export interface RecordReference {
  readonly type: ReferencedRecordType;
  readonly id: string;
}

/**
 * What kind of record depends on another, in the order a refusal lists them:
 * - `product` — named by the product's name
 * - `standard-bom` — by its MI code
 * - `order` — an order assigning the record (a standard BOM), by its order
 *   number (issue #101)
 * - `daily-bom` — by its order number
 * - `resampled-daily-bom` — a re-sample of the record, by its order number
 * - `equipment-pm-plan` — the PM plan of a piece of equipment, by the
 *   equipment's name
 * - `qc-assigned-equipment` — equipment a QC activity is assigned to, by the
 *   equipment's name (issue #119)
 * - `qc-assigned-activity` — a QC activity assigned to the equipment, by the
 *   activity's name (issue #119)
 * - `qc-activity-execution` — a QC record of the activity, counted, unnamed
 * - `qc-equipment-execution` — a QC record on the equipment, counted, unnamed
 */
export const DEPENDENT_KINDS = [
  'product',
  'standard-bom',
  'order',
  'daily-bom',
  'resampled-daily-bom',
  'equipment-pm-plan',
  'qc-assigned-equipment',
  'qc-assigned-activity',
  'qc-activity-execution',
  'qc-equipment-execution',
] as const;

export type DependentKind = (typeof DEPENDENT_KINDS)[number];

/**
 * One record that references another, as a `DependentsProbe` finds it, and
 * its name — `null` for a record with no name a person would recognise it by
 * (a QC record, issue #119), which a refusal counts without naming.
 */
export interface DependentRecord {
  readonly kind: DependentKind;
  readonly name: string | null;
}

/** Every dependent record of one kind: how many, and their names. */
export interface RecordDependent {
  readonly kind: DependentKind;
  readonly count: number;
  readonly names: readonly string[];
}
