import { ApplicationException } from '@framework/application';
import { MiCode } from '@standard-boms/domain/value/mi-code.vo';

export class StandardBomMiCodeAlreadyExists extends ApplicationException {
  private constructor(
    message: string,
    public readonly miCode: MiCode,
  ) {
    super(message);
  }

  public static withMiCode(miCode: MiCode): StandardBomMiCodeAlreadyExists {
    return new StandardBomMiCodeAlreadyExists(
      `A standard BOM already exists with MI code ${miCode.asString()}`,
      miCode,
    );
  }
}
