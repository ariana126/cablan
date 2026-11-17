import { QcExecutionCriteria } from '@maintenance/application/service/qc-execution-filter';

/**
 * The QC records the filters admit, with their intervals and their counts
 * per activity per equipment — the plant-wide records (every filter
 * optional) and the folder's records (by its equipment) alike.
 */
export class GetQcExecutionHistoryQuery {
  constructor(public readonly criteria: QcExecutionCriteria) {}
}
