import { ApplicationException } from '@framework/application';

export class ProductMustHaveAtLeastOneComponent extends ApplicationException {
  private constructor(message: string) {
    super(message);
  }

  public static create(): ProductMustHaveAtLeastOneComponent {
    return new ProductMustHaveAtLeastOneComponent(
      'A product must have at least one component',
    );
  }
}
