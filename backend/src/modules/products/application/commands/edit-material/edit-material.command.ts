import { ApplyToRelatedRecords } from '@framework/application';
import { Identity } from '@framework/domain';
import { MaterialCode } from '@products/domain/value/material-code.vo';
import { MaterialName } from '@products/domain/value/material-name.vo';

export class EditMaterialCommand {
  constructor(
    public readonly materialId: Identity,
    public readonly name: MaterialName,
    public readonly code: MaterialCode,
    /** Issue #110: the System Admin's correction of a material in use — its name and code. */
    public readonly applyToRelatedRecords: ApplyToRelatedRecords = ApplyToRelatedRecords.notAsked(),
  ) {}
}
