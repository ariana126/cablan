import { DomainEvent } from '@framework/domain';

import { BomFieldChange } from './bom-edited.event';

export class BomApproved implements DomainEvent {
  constructor(
    public readonly bomId: string,
    public readonly approvedBy: string,
    public readonly changes: BomFieldChange[],
  ) {}
}
