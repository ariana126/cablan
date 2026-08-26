import { DomainEvent } from '@framework/domain';

export class StandardBomDeleted implements DomainEvent {
  constructor(
    public readonly standardBomId: string,
    public readonly miCode: string,
  ) {}
}
