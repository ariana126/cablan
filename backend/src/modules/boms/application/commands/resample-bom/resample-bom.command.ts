import { BomComponentInput } from '@boms/application/commands/bom-component.input';
import { Identity } from '@framework/domain';

// Re-sampling («نمونه گیری مجدد») a rejected daily BOM: registering a new one
// for the same work order. Only what a new sample changes travels here — its
// weights and description. The order number, tracking number and MI code are
// read from the source BOM, which is what makes them unchangeable.
export class ResampleBomCommand {
  constructor(
    public readonly sourceBomId: Identity,
    public readonly components: BomComponentInput[],
    public readonly description: string | undefined,
    // The acting user's display name, resolved by the controller through
    // `DisplayNameProvider` exactly as for `RegisterBomCommand`.
    public readonly registeredBy: string,
  ) {}
}
