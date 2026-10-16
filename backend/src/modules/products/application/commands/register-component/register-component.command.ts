import { ComponentName } from '@products/domain/value/component-name.vo';

export class RegisterComponentCommand {
  constructor(public readonly name: ComponentName) {}
}
