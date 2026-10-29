import { DomainEvent } from '@framework/domain';

export class EquipmentRegistered implements DomainEvent {
  constructor(
    public readonly equipmentId: string,
    public readonly name: string,
  ) {}
}
