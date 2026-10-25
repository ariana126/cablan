import { DomainEvent } from '@framework/domain';

import { BomFieldChange } from './bom-edited.event';

/**
 * A pending daily BOM was rejected. `managementNote` is the reviewer's
 * reason, as typed (trimmed). `changes` are the status, reviewer and note
 * lines; `trackingNumber` is the audit entry's subject, as on `BomApproved`.
 */
export class BomRejected implements DomainEvent {
  constructor(
    public readonly bomId: string,
    public readonly reviewedBy: string,
    public readonly managementNote: string,
    public readonly trackingNumber: string,
    public readonly changes: BomFieldChange[],
  ) {}
}
