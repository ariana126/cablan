import { RecordReference } from './record-reference';

/** The fields a correction may change: a name and, for a material, a code. */
export interface CorrectableFields {
  readonly name: string;
  readonly code?: string;
}

/**
 * What a correction changed of a record in use (issue #110): its name, and —
 * a material's — its code. A field left out did not change.
 */
export interface RecordCorrection {
  readonly name?: string;
  readonly code?: string;
}

/**
 * The port through which a module that holds snapshots of a record carries
 * a System Admin's correction of it into them (issue #110) — the
 * `DependentsProbe`'s counterpart, for the same reason: the corrected record
 * lives upstream of whoever copied its name, so its owner cannot reach them
 * without reversing the dependencies.
 *
 * Each module holding snapshots provides one implementation, rewriting only
 * the snapshot columns that carry the corrected name or code of the record
 * types it holds — and doing nothing for any other type. It writes in the
 * caller's transaction, directly, never through an aggregate's edit method:
 * a correction is not an edit of the related records, so it records no
 * domain event and changes nothing else (weights, due dates, approval
 * statuses). Registering it in the module's `providers` is the whole
 * registration, as for a probe.
 *
 * `before` is the record's correctable fields as they stood before the
 * correction — for a module whose snapshots find the record by its name
 * rather than its id (`boms`' daily BOMs hold their order's number, not its
 * id; issue #101). Most implementations need only the id and ignore it.
 */
export abstract class CorrectionPropagator {
  abstract propagate(
    reference: RecordReference,
    correction: RecordCorrection,
    before: CorrectableFields,
  ): Promise<void>;
}
