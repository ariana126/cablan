import { DomainEvent } from '@framework/domain';

export class ComponentRenamed implements DomainEvent {
  constructor(
    public readonly componentId: string,
    public readonly previousName: string,
    public readonly newName: string,
  ) {}
}
