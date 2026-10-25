import { DomainEvent } from '@framework/domain';

import { BomFieldChange } from './bom-edited.event';

/**
 * An edit of an approved or rejected daily BOM sent it back to pending.
 * Recorded right after that edit's `BomEdited`. `trackingNumber` is the BOM's
 * tracking number after the edit — so an edit that changed it names the new
 * one. `changes` are the status and reviewer lines, plus the management note
 * line when the review had one.
 */
export class BomReturnedToPending implements DomainEvent {
  constructor(
    public readonly bomId: string,
    public readonly trackingNumber: string,
    public readonly changes: BomFieldChange[],
  ) {}
}
