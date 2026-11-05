import { DomainEvent } from '@framework/domain';

// One line per field that actually changed: `orderNumber`, and `miCodes` —
// the order's MI codes before and after, joined by `, ` in assignment order.
export interface OrderFieldChange {
  readonly field: 'orderNumber' | 'miCodes';
  readonly previousValue: string;
  readonly newValue: string;
}

export class OrderEdited implements DomainEvent {
  constructor(
    public readonly orderId: string,
    // The order number after the edit.
    public readonly orderNumber: string,
    public readonly changes: OrderFieldChange[],
  ) {}
}
