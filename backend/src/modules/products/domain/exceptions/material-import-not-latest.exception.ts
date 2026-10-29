import { DomainException } from '@framework/domain';

// Thrown when reverting a material import while a later one is still in
// place: imports are undone newest first, so only the latest import not yet
// reverted may be. A 409 `material-import-not-latest`.
export class MaterialImportNotLatest extends DomainException {
  private constructor(
    message: string,
    public readonly importId: string,
  ) {
    super(message);
  }

  public static withId(importId: string): MaterialImportNotLatest {
    return new MaterialImportNotLatest(
      `Material import ${importId} is not the latest import still in place`,
      importId,
    );
  }
}
