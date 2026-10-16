import { ApplicationException } from '@framework/application';

export class ManufacturingInstructionMustHaveAtLeastOneComponent extends ApplicationException {
  private constructor(message: string) {
    super(message);
  }

  public static create(): ManufacturingInstructionMustHaveAtLeastOneComponent {
    return new ManufacturingInstructionMustHaveAtLeastOneComponent(
      'A standard BOM must have at least one component',
    );
  }
}
