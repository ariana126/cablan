import { DomainEvent } from '@framework/domain';

export class MaterialRenamed implements DomainEvent {
  constructor(
    public readonly materialId: string,
    public readonly previousName: string,
    public readonly newName: string,
  ) {}
}
