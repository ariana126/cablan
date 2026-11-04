import { ApplyToRelatedRecords } from '@framework/application';
import { Identity } from '@framework/domain';
import { EquipmentName } from '@maintenance/domain/value/equipment-name.vo';

export class RenameEquipmentCommand {
  constructor(
    public readonly equipmentId: Identity,
    public readonly name: EquipmentName,
    /** Issue #110: the System Admin's correction of equipment in use. */
    public readonly applyToRelatedRecords: ApplyToRelatedRecords = ApplyToRelatedRecords.notAsked(),
  ) {}
}
