import { DomainEvent } from '@framework/domain';

export class EquipmentRetired implements DomainEvent {
  constructor(
    public readonly equipmentId: string,
    public readonly name: string,
  ) {}
}
