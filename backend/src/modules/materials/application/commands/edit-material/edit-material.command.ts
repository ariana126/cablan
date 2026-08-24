import { Identity } from '@framework/domain';
import { MaterialName } from '@materials/domain/value/material-name.vo';

export class EditMaterialCommand {
  constructor(
    public readonly materialId: Identity,
    public readonly name: MaterialName,
  ) {}
}
