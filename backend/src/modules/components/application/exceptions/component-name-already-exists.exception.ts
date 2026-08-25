import { ComponentName } from '@components/domain/value/component-name.vo';
import { ApplicationException } from '@framework/application';

export class ComponentNameAlreadyExists extends ApplicationException {
  private constructor(
    message: string,
    public readonly componentName: ComponentName,
  ) {
    super(message);
  }

  public static withName(name: ComponentName): ComponentNameAlreadyExists {
    return new ComponentNameAlreadyExists(
      `A component already exists with name ${name.asString()}`,
      name,
    );
  }
}
