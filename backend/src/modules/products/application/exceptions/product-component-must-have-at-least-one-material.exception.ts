import { ApplicationException } from '@framework/application';

export class ProductComponentMustHaveAtLeastOneMaterial extends ApplicationException {
  private constructor(
    message: string,
    public readonly componentName: string,
  ) {
    super(message);
  }

  public static forComponent(
    componentName: string,
  ): ProductComponentMustHaveAtLeastOneMaterial {
    return new ProductComponentMustHaveAtLeastOneMaterial(
      `Component ${componentName} must have at least one material`,
      componentName,
    );
  }
}
