import { DomainEvent } from '@framework/domain';

export class EquipmentRenamed implements DomainEvent {
  constructor(
    public readonly equipmentId: string,
    public readonly previousName: string,
    public readonly newName: string,
  ) {}
}
