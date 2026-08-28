import { BomComponentInput } from '@boms/application/commands/bom-component.input';
import { OrderNumber } from '@boms/domain/value/order-number.vo';
import { TrackingNumber } from '@boms/domain/value/tracking-number.vo';

// Carries the standard BOM's business MI code as a plain string, not an
// `Identity` and not `standard-boms`' own `MiCode` value object: `boms` must
// not import `standard-boms`' domain layer, only the query + read-model pair
// the dependency-cruiser exception whitelists (see
// `BomCompositionFactory`/src/modules/boms/CLAUDE.md). `BomCompositionFactory`
// resolves it to the standard BOM's actual id, which is what ends up fixed
// onto the registered `Bom` as `standardBomId`.
export class RegisterBomCommand {
  constructor(
    public readonly standardBomMiCode: string,
    public readonly orderNumber: OrderNumber,
    public readonly trackingNumber: TrackingNumber,
    public readonly description: string | undefined,
    public readonly components: BomComponentInput[],
    // The acting user's display name, resolved by `BomController.register()`
    // through `DisplayNameProvider` from the `@CurrentUser()` id — cloned onto
    // the registered `Bom` as `registeredBy`, immutable afterwards. See
    // src/modules/boms/CLAUDE.md.
    public readonly registeredBy: string,
  ) {}
}
