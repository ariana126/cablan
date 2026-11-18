import { RecordReference } from './record-reference';

/**
 * The port through which a module holding snapshots of a record's composition
 * lays them out in the record's new component order (issue #122) — the
 * `CorrectionPropagator`'s counterpart for a reordering, for the same reason:
 * the reordered record (a product) lives upstream of whoever copied its
 * composition, so its owner cannot reach them without reversing the
 * dependencies.
 *
 * Each module holding such snapshots provides one implementation, rewriting
 * only the component positions of its own snapshots of the record types it
 * holds — and doing nothing for any other type. Lines are matched by
 * component id (`orderedByComponentIds`); a line whose component is not in
 * the order keeps its relative place after the matched ones. It writes in the
 * caller's transaction, directly, never through an aggregate: no domain
 * event, no audit entry, nothing else of the snapshot changes. Registering it
 * in the module's `providers` is the whole registration, as for a probe.
 */
export abstract class CompositionOrderPropagator {
  abstract propagate(
    reference: RecordReference,
    orderedComponentIds: readonly string[],
  ): Promise<void>;
}
