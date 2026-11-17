import { ApplyToRelatedRecords } from '@framework/application';
import { Identity } from '@framework/domain';
import { QcActivityName } from '@maintenance/domain/value/qc-activity-name.vo';

export class RenameQcActivityCommand {
  constructor(
    public readonly activityId: Identity,
    public readonly name: QcActivityName,
    /** The System Admin's correction of a QC activity in use (issue #119). */
    public readonly applyToRelatedRecords: ApplyToRelatedRecords = ApplyToRelatedRecords.notAsked(),
  ) {}
}
