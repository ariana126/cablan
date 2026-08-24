import { DomainEvent } from '@framework/domain';

export class MaterialDeleted implements DomainEvent {
  constructor(
    public readonly materialId: string,
    public readonly name: string,
  ) {}
}
