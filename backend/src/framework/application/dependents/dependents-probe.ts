import { DependentRecord, RecordReference } from './record-reference';

/**
 * The port through which a module that holds references answers "which of my
 * records reference this one?" (issue #94).
 *
 * Protected records live upstream of whoever references them (`boms` →
 * `manufacturing-instructions` → `products`), so the owner of a record cannot
 * ask its consumers without reversing those dependencies. Instead each
 * referencing module provides one implementation, answering from its **own**
 * tables only, for the record types it references — and none for any other
 * type. A provider extending this class is found by `RecordDependenciesModule`
 * on its own: registering it in the module's `providers` is the whole
 * registration.
 *
 * Return one entry per dependent record (a product that uses a material in two
 * of its components is one entry), and only direct references.
 */
export abstract class DependentsProbe {
  abstract dependentsOf(
    reference: RecordReference,
  ): Promise<readonly DependentRecord[]>;
}
