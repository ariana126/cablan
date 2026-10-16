import { DomainEvent } from '@framework/domain';

import { ManufacturingInstructionSnapshot } from './manufacturing-instruction.snapshot';

export class ManufacturingInstructionRegistered implements DomainEvent {
  constructor(
    public readonly manufacturingInstructionId: string,
    // Everything the standard BOM was registered with, composition included.
    public readonly snapshot: ManufacturingInstructionSnapshot,
  ) {}
}
