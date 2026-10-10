import { MaterialCode } from '@materials/domain/value/material-code.vo';
import { MaterialName } from '@materials/domain/value/material-name.vo';

export class RegisterMaterialCommand {
  constructor(
    public readonly name: MaterialName,
    // `null` = registered without a code.
    public readonly code: MaterialCode | null,
  ) {}
}
