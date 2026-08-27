import { DomainEvent } from '@framework/domain';

export class BomDeleted implements DomainEvent {
  constructor(
    public readonly bomId: string,
    public readonly orderNumber: string,
  ) {}
}
