import { DomainEvent } from '@framework/domain';

// Issue #110: retired equipment deleted with its whole plan and every
// execution of it; its name is free again.
export class EquipmentDeleted implements DomainEvent {
  constructor(
    public readonly equipmentId: string,
    public readonly name: string,
  ) {}
}
