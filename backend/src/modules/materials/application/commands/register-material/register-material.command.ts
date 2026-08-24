import { MaterialName } from '@materials/domain/value/material-name.vo';

export class RegisterMaterialCommand {
  constructor(public readonly name: MaterialName) {}
}
