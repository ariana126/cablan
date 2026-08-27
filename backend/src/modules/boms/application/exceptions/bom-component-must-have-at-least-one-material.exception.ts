import { ApplicationException } from '@framework/application';

export class BomComponentMustHaveAtLeastOneMaterial extends ApplicationException {
  private constructor(
    message: string,
    public readonly componentId: string,
  ) {
    super(message);
  }

  public static forComponent(
    componentId: string,
  ): BomComponentMustHaveAtLeastOneMaterial {
    return new BomComponentMustHaveAtLeastOneMaterial(
      `Component ${componentId} must have at least one material`,
      componentId,
    );
  }
}
