import { ComponentName } from '@components/domain/value/component-name.vo';
import { Identity } from '@framework/domain';

export class EditComponentCommand {
  constructor(
    public readonly componentId: Identity,
    public readonly name: ComponentName,
  ) {}
}
