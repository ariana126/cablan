import { MaterialCode } from '@products/domain/value/material-code.vo';
import { MaterialName } from '@products/domain/value/material-name.vo';

export class RegisterMaterialCommand {
  constructor(
    public readonly name: MaterialName,
    public readonly code: MaterialCode,
  ) {}
}
