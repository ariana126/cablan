import { ApplicationException } from '@framework/application';
import { MaterialCode } from '@products/domain/value/material-code.vo';

export class MaterialCodeAlreadyExists extends ApplicationException {
  private constructor(
    message: string,
    public readonly materialCode: MaterialCode,
  ) {
    super(message);
  }

  public static withCode(code: MaterialCode): MaterialCodeAlreadyExists {
    return new MaterialCodeAlreadyExists(
      `A material already exists with code ${code.asString()}`,
      code,
    );
  }
}
