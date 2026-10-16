import { DomainEvent } from '@framework/domain';

export class ComponentDeleted implements DomainEvent {
  constructor(
    public readonly componentId: string,
    public readonly name: string,
  ) {}
}
