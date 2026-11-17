import { Identity } from '@framework/domain';

/** One QC record deleted by the System Admin (issue #119). */
export class DeleteQcExecutionCommand {
  constructor(public readonly executionId: Identity) {}
}
