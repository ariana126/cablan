import { OrderNumber } from '@boms/domain/value/order-number.vo';

// `miCodes` as typed — resolved to standard BOMs by `StandardBomLookup`,
// since `boms` may not import `manufacturing-instructions`' `MiCode`.
export class DefineOrderCommand {
  constructor(
    public readonly orderNumber: OrderNumber,
    public readonly miCodes: readonly string[],
  ) {}
}
