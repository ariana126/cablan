import { CompositionOrderPropagator } from '../dependents/composition-order-propagator';
import { RecordReference } from '../dependents/record-reference';

/**
 * A `CompositionOrderPropagator` for unit specs: notes every new order it was
 * handed, in order. Not wired into any module.
 */
export class StubCompositionOrderPropagator extends CompositionOrderPropagator {
  readonly propagated: {
    reference: RecordReference;
    orderedComponentIds: string[];
  }[] = [];

  propagate(
    reference: RecordReference,
    orderedComponentIds: readonly string[],
  ): Promise<void> {
    this.propagated.push({
      reference,
      orderedComponentIds: [...orderedComponentIds],
    });
    return Promise.resolve();
  }
}
