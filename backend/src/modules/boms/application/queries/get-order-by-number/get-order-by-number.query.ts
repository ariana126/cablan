import { OrderNumber } from '@boms/domain/value/order-number.vo';

export class GetOrderByNumberQuery {
  constructor(public readonly orderNumber: OrderNumber) {}
}
