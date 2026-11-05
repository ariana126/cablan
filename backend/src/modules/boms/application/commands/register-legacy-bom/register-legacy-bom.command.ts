import { BomComponentInput } from '@boms/application/commands/bom-component.input';
import { OrderNumber } from '@boms/domain/value/order-number.vo';
import { TrackingNumber } from '@boms/domain/value/tracking-number.vo';

/**
 * A daily BOM registered as one was before orders existed (issue #101):
 * for any order number, with any MI code — no order is consulted. Sent only
 * by the test stack's `POST /testing/boms/legacy-daily-boms`, to set up the
 * legacy carry-over; never reachable in production.
 */
export class RegisterLegacyBomCommand {
  constructor(
    public readonly standardBomMiCode: string,
    public readonly orderNumber: OrderNumber,
    public readonly trackingNumber: TrackingNumber,
    public readonly description: string | undefined,
    public readonly components: BomComponentInput[],
    public readonly registeredBy: string,
  ) {}
}
