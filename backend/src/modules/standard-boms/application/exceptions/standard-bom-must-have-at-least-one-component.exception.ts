import { ApplicationException } from '@framework/application';

export class StandardBomMustHaveAtLeastOneComponent extends ApplicationException {
  private constructor(message: string) {
    super(message);
  }

  public static create(): StandardBomMustHaveAtLeastOneComponent {
    return new StandardBomMustHaveAtLeastOneComponent(
      'A standard BOM must have at least one component',
    );
  }
}
