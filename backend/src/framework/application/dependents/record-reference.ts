/**
 * The record types another record can reference — and that therefore can be
 * locked against edit and delete while referenced (issue #94). The values are
 * also the wire's `recordType`, so they keep the audit log's record-type
 * names.
 */
export type ReferencedRecordType =
  | 'Material'
  | 'Component'
  | 'Product'
  | 'StandardBom'
  | 'Bom'
  | 'Equipment'
  | 'MaintenanceActivity';

/** "This record": its type and its id. */
export interface RecordReference {
  readonly type: ReferencedRecordType;
  readonly id: string;
}

/**
 * What kind of record depends on another, in the order a refusal lists them:
 * - `product` — named by the product's name
 * - `standard-bom` — by its MI code
 * - `daily-bom` — by its order number
 * - `resampled-daily-bom` — a re-sample of the record, by its order number
 * - `equipment-pm-plan` — the PM plan of a piece of equipment, by the
 *   equipment's name
 */
export const DEPENDENT_KINDS = [
  'product',
  'standard-bom',
  'daily-bom',
  'resampled-daily-bom',
  'equipment-pm-plan',
] as const;

export type DependentKind = (typeof DEPENDENT_KINDS)[number];

/** One record that references another, as a `DependentsProbe` finds it. */
export interface DependentRecord {
  readonly kind: DependentKind;
  readonly name: string;
}

/** Every dependent record of one kind: how many, and their names. */
export interface RecordDependent {
  readonly kind: DependentKind;
  readonly count: number;
  readonly names: readonly string[];
}
