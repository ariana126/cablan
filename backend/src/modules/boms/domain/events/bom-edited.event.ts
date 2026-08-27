import { DomainEvent } from '@framework/domain';

export class BomEdited implements DomainEvent {
  constructor(
    public readonly bomId: string,
    public readonly orderNumber: string,
    public readonly trackingNumber: string,
    public readonly description: string | undefined,
  ) {}
}
