import {
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

  propagate(
    reference: RecordReference,
    correction: RecordCorrection,
  ): Promise<void> {
    this.propagated.push({ reference, correction: { ...correction } });
    return Promise.resolve();
  }
}
