import { DomainEvent } from '@framework/domain';

import { BomFieldChange } from './bom-edited.event';

/**
 * `trackingNumber` is the BOM's tracking number as it stands once approved —
 * the reference a reader identifies the daily BOM by in the audit log.
 */
export class BomApproved implements DomainEvent {
  constructor(
    public readonly bomId: string,
    public readonly approvedBy: string,
    public readonly trackingNumber: string,
    public readonly changes: BomFieldChange[],
  ) {}
}
