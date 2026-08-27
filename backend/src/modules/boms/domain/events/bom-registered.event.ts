import { DomainEvent } from '@framework/domain';

export class BomRegistered implements DomainEvent {
  constructor(
    public readonly bomId: string,
    public readonly standardBomId: string,
    public readonly orderNumber: string,
    public readonly trackingNumber: string,
    public readonly componentIds: string[],
  ) {}
}
