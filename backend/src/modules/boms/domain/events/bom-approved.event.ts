import { DomainEvent } from '@framework/domain';

import { BomFieldChange } from './bom-edited.event';

/**
 * A pending daily BOM was approved. `managementNote` is the note approving
 * recorded from the edits by any reviewer during the review, or `null` when
 * there were none. `trackingNumber` is the BOM's tracking number as it stands
 * once approved — the reference a reader identifies the daily BOM by in the
 * audit log. `changes` are the status, reviewer and (when there is one) note
 * lines.
 */
export class BomApproved implements DomainEvent {
  constructor(
    public readonly bomId: string,
    public readonly reviewedBy: string,
    public readonly managementNote: string | null,
    public readonly trackingNumber: string,
    public readonly changes: BomFieldChange[],
  ) {}
}
