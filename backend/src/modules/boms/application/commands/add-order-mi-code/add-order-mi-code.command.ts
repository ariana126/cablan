import { Identity } from '@framework/domain';

export class AddOrderMiCodeCommand {
  constructor(
    public readonly orderId: Identity,
    // As typed; see `DefineOrderCommand`.
    public readonly miCode: string,
  ) {}
}
