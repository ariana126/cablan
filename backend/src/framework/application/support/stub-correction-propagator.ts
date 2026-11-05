import {
  CorrectableFields,
  CorrectionPropagator,
  RecordCorrection,
} from '../dependents/correction-propagator';
import { RecordReference } from '../dependents/record-reference';

/**
 * A `CorrectionPropagator` for unit specs: notes every correction it was
 * handed, in order. Not wired into any module.
 */
export class StubCorrectionPropagator extends CorrectionPropagator {
  readonly propagated: {
    reference: RecordReference;
    correction: RecordCorrection;
  }[] = [];
  /** The `before` each correction was handed with, in the same order. */
  readonly previousFields: CorrectableFields[] = [];

  propagate(
    reference: RecordReference,
    correction: RecordCorrection,
    before: CorrectableFields,
  ): Promise<void> {
    this.propagated.push({ reference, correction: { ...correction } });
    this.previousFields.push({ ...before });
    return Promise.resolve();
  }
}
