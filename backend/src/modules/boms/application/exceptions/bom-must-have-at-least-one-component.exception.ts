import { ApplicationException } from '@framework/application';

export class BomMustHaveAtLeastOneComponent extends ApplicationException {
  private constructor(message: string) {
    super(message);
  }

  public static create(): BomMustHaveAtLeastOneComponent {
    return new BomMustHaveAtLeastOneComponent(
      'A BOM must have at least one component',
    );
  }
}
