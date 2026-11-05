import { DomainEvent } from '@framework/domain';

import { OrderSnapshot } from './order.snapshot';

export class OrderDefined implements DomainEvent {
  constructor(
    public readonly orderId: string,
    public readonly snapshot: OrderSnapshot,
  ) {}
}
