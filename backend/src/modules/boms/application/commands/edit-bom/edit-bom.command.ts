import { BomComponentInput } from '@boms/application/commands/bom-component.input';
import { OrderNumber } from '@boms/domain/value/order-number.vo';
import { TrackingNumber } from '@boms/domain/value/tracking-number.vo';
import { Identity } from '@framework/domain';

// Every field but `bomId` is optional: `undefined` means "leave unchanged",
// the same convention `EditStandardBomCommand` uses for its own scalar
// fields. The referenced standard BOM itself is not editable (see
// `Bom.edit()`'s doc comment) — there is no `standardBomId` here for the same
// reason `EditStandardBomCommand` has no `productId` — but unlike
// `standard-boms`, `boms` has no stored MI code of its own to refetch the
// current composition from when only its own `standardBomId: Identity` is on
// hand (see `BomCompositionFactory`, which reads by MI code, not by id).
// `standardBomMiCode` exists for that reason alone: it is required *in
// practice* whenever `components` is also given, to reclone the current
// composition — enforced by the HTTP DTO (`@ValidateIf` on `components`) and,
// defensively, by `EditBomHandler` itself for any caller that bypasses the
// DTO — but it never changes what the `Bom`'s own `standardBomId` resolves
// to: `Bom.updateComponents()` never reassigns it. See
// src/modules/boms/CLAUDE.md.
export class EditBomCommand {
  constructor(
    public readonly bomId: Identity,
    public readonly orderNumber?: OrderNumber,
    public readonly trackingNumber?: TrackingNumber,
    public readonly description?: string,
    public readonly components?: BomComponentInput[],
    public readonly standardBomMiCode?: string,
  ) {}
}
