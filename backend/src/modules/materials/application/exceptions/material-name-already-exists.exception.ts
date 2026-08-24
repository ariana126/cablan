import { ApplicationException } from '@framework/application';
import { MaterialName } from '@materials/domain/value/material-name.vo';

export class MaterialNameAlreadyExists extends ApplicationException {
  private constructor(
    message: string,
    public readonly materialName: MaterialName,
  ) {
    super(message);
  }

  public static withName(name: MaterialName): MaterialNameAlreadyExists {
    return new MaterialNameAlreadyExists(
      `A material already exists with name ${name.asString()}`,
      name,
    );
  }
}
