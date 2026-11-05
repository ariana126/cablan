import { Identity } from '@framework/domain';

export class GetOrderQuery {
  constructor(public readonly orderId: Identity) {}
}
