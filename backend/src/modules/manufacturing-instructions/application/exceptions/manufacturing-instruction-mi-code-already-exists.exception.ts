import { ApplicationException } from '@framework/application';
import { MiCode } from '@manufacturing-instructions/domain/value/mi-code.vo';

export class ManufacturingInstructionMiCodeAlreadyExists extends ApplicationException {
  private constructor(
    message: string,
    public readonly miCode: MiCode,
  ) {
    super(message);
  }

  public static withMiCode(
    miCode: MiCode,
  ): ManufacturingInstructionMiCodeAlreadyExists {
    return new ManufacturingInstructionMiCodeAlreadyExists(
      `A standard BOM already exists with MI code ${miCode.asString()}`,
      miCode,
    );
  }
}
