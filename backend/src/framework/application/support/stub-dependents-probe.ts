import { DependentsProbe } from '../dependents/dependents-probe';
import {
  DependentRecord,
  RecordReference,
} from '../dependents/record-reference';

/**
 * A `DependentsProbe` for unit specs: answers exactly the dependents it was
 * `given` for a record, and none for any other. Not wired into any module.
 */
export class StubDependentsProbe extends DependentsProbe {
  private readonly answers = new Map<string, DependentRecord[]>();

  given(
    reference: RecordReference,
    dependents: readonly DependentRecord[],
  ): this {
    this.answers.set(StubDependentsProbe.keyOf(reference), [...dependents]);
    return this;
  }

  dependentsOf(
    reference: RecordReference,
  ): Promise<readonly DependentRecord[]> {
    return Promise.resolve(
      this.answers.get(StubDependentsProbe.keyOf(reference)) ?? [],
    );
  }

  private static keyOf(reference: RecordReference): string {
    return `${reference.type}:${reference.id}`;
  }
}
