import { DomainEvent } from '@framework/domain';

export class ComponentRegistered implements DomainEvent {
  constructor(
    public readonly componentId: string,
    public readonly name: string,
  ) {}
}
