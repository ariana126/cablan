import { OrderNumber } from '@boms/domain/value/order-number.vo';
import { ApplyToRelatedRecords } from '@framework/application';
import { Identity } from '@framework/domain';

// `undefined` leaves a field as it is. `miCodes`, when given, replaces the
// order's MI codes (as typed; see `DefineOrderCommand`).
export class EditOrderCommand {
  constructor(
    public readonly orderId: Identity,
    public readonly orderNumber?: OrderNumber,
    public readonly miCodes?: readonly string[],
    /** Issue #110: the System Admin's correction of the number of an order in use. */
    public readonly applyToRelatedRecords: ApplyToRelatedRecords = ApplyToRelatedRecords.notAsked(),
  ) {}
}
