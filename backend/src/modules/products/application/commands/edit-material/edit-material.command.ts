import { Identity } from '@framework/domain';
import { MaterialCode } from '@products/domain/value/material-code.vo';
import { MaterialName } from '@products/domain/value/material-name.vo';

export class EditMaterialCommand {
  constructor(
    public readonly materialId: Identity,
    public readonly name: MaterialName,
    // `undefined` = leave the code as is; `null` = clear it.
    public readonly code: MaterialCode | null | undefined,
  ) {}
}
