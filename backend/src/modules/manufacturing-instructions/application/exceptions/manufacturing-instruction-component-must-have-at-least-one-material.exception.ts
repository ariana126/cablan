import { ApplicationException } from '@framework/application';

export class ManufacturingInstructionComponentMustHaveAtLeastOneMaterial extends ApplicationException {
  private constructor(
    message: string,
    public readonly componentId: string,
  ) {
    super(message);
  }

  public static forComponent(
    componentId: string,
  ): ManufacturingInstructionComponentMustHaveAtLeastOneMaterial {
    return new ManufacturingInstructionComponentMustHaveAtLeastOneMaterial(
      `Component ${componentId} must have at least one material`,
      componentId,
    );
  }
}
