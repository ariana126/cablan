import { QcActivityName } from '@maintenance/domain/value/qc-activity-name.vo';

/** A QC activity defined in the catalog, assigned to no equipment yet. */
export class DefineQcActivityCommand {
  constructor(public readonly name: QcActivityName) {}
}
