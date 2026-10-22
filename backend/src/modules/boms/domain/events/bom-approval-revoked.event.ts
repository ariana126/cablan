import { DomainEvent } from '@framework/domain';

import { BomFieldChange } from './bom-edited.event';

/**
 * Recorded both by a direct revoke and, right after `BomEdited`, by an edit
 * that voided an approval. `trackingNumber` is the BOM's tracking number
 * after the command — so an edit that changed it names the new one.
 */
export class BomApprovalRevoked implements DomainEvent {
  constructor(
    public readonly bomId: string,
    public readonly trackingNumber: string,
    public readonly changes: BomFieldChange[],
  ) {}
}
