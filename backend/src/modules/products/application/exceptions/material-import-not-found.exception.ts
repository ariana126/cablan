import { ApplicationException } from '@framework/application';
import { Identity } from '@framework/domain';

// Thrown when reverting a material import that doesn't exist. Its own 404
// `material-import-not-found` rather than the generic `entity-not-found`.
export class MaterialImportNotFound extends ApplicationException {
  private constructor(
    message: string,
    public readonly importId: string,
  ) {
    super(message);
  }

  public static withId(importId: Identity): MaterialImportNotFound {
    return new MaterialImportNotFound(
      `No material import exists with id ${importId.asString()}`,
      importId.asString(),
    );
  }
}
