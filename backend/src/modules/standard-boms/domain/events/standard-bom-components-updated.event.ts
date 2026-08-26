import { DomainEvent } from '@framework/domain';

export class StandardBomComponentsUpdated implements DomainEvent {
  constructor(
    public readonly standardBomId: string,
    public readonly componentIds: string[],
  ) {}
}
