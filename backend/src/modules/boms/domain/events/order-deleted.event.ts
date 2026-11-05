import { DomainEvent } from '@framework/domain';

import { OrderSnapshot } from './order.snapshot';

export class OrderDeleted implements DomainEvent {
  constructor(
    public readonly orderId: string,
    // The order as it stood when deleted.
    public readonly snapshot: OrderSnapshot,
  ) {}
}
