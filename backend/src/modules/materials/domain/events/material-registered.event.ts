import { DomainEvent } from '@framework/domain';

export class MaterialRegistered implements DomainEvent {
  constructor(
    public readonly materialId: string,
    public readonly name: string,
  ) {}
}
