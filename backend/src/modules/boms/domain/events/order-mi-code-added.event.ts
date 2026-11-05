import { DomainEvent } from '@framework/domain';

// An MI code assigned to an order that already exists («افزودن کد MI») —
// allowed even while the order has daily BOMs, which it leaves untouched.
export class OrderMiCodeAdded implements DomainEvent {
  constructor(
    public readonly orderId: string,
    public readonly orderNumber: string,
    public readonly miCode: string,
    public readonly productName: string,
  ) {}
}
