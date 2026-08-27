import { DomainEvent } from '@framework/domain';

export class BomComponentsUpdated implements DomainEvent {
  constructor(
    public readonly bomId: string,
    public readonly componentIds: string[],
  ) {}
}
