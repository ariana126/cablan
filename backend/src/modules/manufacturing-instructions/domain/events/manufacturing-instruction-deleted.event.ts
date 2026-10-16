import { DomainEvent } from '@framework/domain';

import { ManufacturingInstructionSnapshot } from './manufacturing-instruction.snapshot';

export class ManufacturingInstructionDeleted implements DomainEvent {
  constructor(
    public readonly manufacturingInstructionId: string,
    // The standard BOM as it stood when deleted, composition included.
    public readonly snapshot: ManufacturingInstructionSnapshot,
  ) {}
}
