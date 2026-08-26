import { Identity } from '@framework/domain';

export class GetProductQuery {
  constructor(public readonly productId: Identity) {}
}
