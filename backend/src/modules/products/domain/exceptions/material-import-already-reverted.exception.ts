import { DomainException } from '@framework/domain';

// Thrown when reverting a bulk import that was already reverted: a reversion
// is final, and can't itself be reverted either.
export class MaterialImportAlreadyReverted extends DomainException {
  private constructor(
    message: string,
    public readonly importId: string,
  ) {
    super(message);
  }

  public static withId(importId: string): MaterialImportAlreadyReverted {
    return new MaterialImportAlreadyReverted(
      `Material import ${importId} has already been reverted`,
      importId,
    );
  }
}
