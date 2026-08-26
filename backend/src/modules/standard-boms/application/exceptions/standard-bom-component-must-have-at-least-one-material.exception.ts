import { ApplicationException } from '@framework/application';

export class StandardBomComponentMustHaveAtLeastOneMaterial extends ApplicationException {
  private constructor(
    message: string,
    public readonly componentId: string,
  ) {
    super(message);
  }

  public static forComponent(
    componentId: string,
  ): StandardBomComponentMustHaveAtLeastOneMaterial {
    return new StandardBomComponentMustHaveAtLeastOneMaterial(
      `Component ${componentId} must have at least one material`,
      componentId,
    );
  }
}
