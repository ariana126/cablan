import { Identity } from '@framework/domain';
import { ComponentName } from '@products/domain/value/component-name.vo';

export class EditComponentCommand {
  constructor(
    public readonly componentId: Identity,
    public readonly name: ComponentName,
  ) {}
}
