import { DomainEvent } from '@framework/domain';

import { BomFieldChange } from './bom-edited.event';

export class BomApprovalRevoked implements DomainEvent {
  constructor(
    public readonly bomId: string,
    public readonly changes: BomFieldChange[],
  ) {}
}
