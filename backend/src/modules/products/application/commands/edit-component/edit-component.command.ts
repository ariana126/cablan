import { ApplyToRelatedRecords } from '@framework/application';
import { Identity } from '@framework/domain';
import { ComponentName } from '@products/domain/value/component-name.vo';

export class EditComponentCommand {
  constructor(
    public readonly componentId: Identity,
    public readonly name: ComponentName,
    /** Issue #110: the System Admin's correction of a component in use. */
    public readonly applyToRelatedRecords: ApplyToRelatedRecords = ApplyToRelatedRecords.notAsked(),
  ) {}
}
