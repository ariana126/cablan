import { ApplicationException } from '@framework/application';

// Thrown when no row of a confirmed import would change any material: there
// is nothing to apply, and an import with no change is not recorded.
export class MaterialImportEmpty extends ApplicationException {
  public static create(): MaterialImportEmpty {
    return new MaterialImportEmpty('The material import changes no material');
  }
}
