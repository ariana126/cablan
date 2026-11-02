import { PROBLEM } from '../problem-details';
import { RecordDependents } from '../record-has-dependents';

/** The 409 `record-has-dependents` body as the API sends it, for a spec to `flush` with
 * `{ status: 409, statusText: 'Conflict' }`. Defaults to one product, «کابل NYY». */
export function recordHasDependentsBody(
  dependents: readonly RecordDependents[] = [{ kind: 'product', count: 1, names: ['کابل NYY'] }],
  recordType = 'Material',
) {
  return {
    type: PROBLEM.recordHasDependents,
    title: 'Record has dependents',
    status: 409,
    detail: `${recordType} cannot be edited or deleted: it is referenced by other records.`,
    recordType,
    dependents,
  };
}

export const CONFLICT = { status: 409, statusText: 'Conflict' } as const;
