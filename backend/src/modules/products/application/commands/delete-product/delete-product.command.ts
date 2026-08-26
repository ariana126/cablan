import { Identity } from '@framework/domain';

export class DeleteProductCommand {
  constructor(public readonly productId: Identity) {}
}
