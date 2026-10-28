import { BomComponentInput } from '@boms/application/commands/bom-component.input';
import { BomEditSource } from '@boms/domain/value/bom-edit-source';
import { OrderNumber } from '@boms/domain/value/order-number.vo';
import { TrackingNumber } from '@boms/domain/value/tracking-number.vo';
import { Identity, Role } from '@framework/domain';

// `editorRole` is the acting user's current role, looked up by the
// controller through `UserRoleProvider` (`null` for an unknown user), and
// `editSource` where they edited from: together they decide whether the edit
// is a review edit (a reviewer, from the dashboard), which approving the BOM
// then notes, or a correction, kept as an edit detail (see `Bom.edit()` and
// `BomEditContext`). `editedBy` is their display name, resolved by the
// controller through `DisplayNameProvider` like `registeredBy`; `editReason`
// is why, as typed — required in substance only when the edit changes
// something, which only the aggregate can tell.
//
// Every field after those is optional: `undefined` means "leave unchanged",
// the same convention `EditManufacturingInstructionCommand` uses for its own scalar
// fields. The referenced standard BOM itself is not editable (see
// `Bom.edit()`'s doc comment) — there is no `standardBomId` here for the same
// reason `EditManufacturingInstructionCommand` has no `productId` — but unlike
// `manufacturing-instructions`, `boms` has no stored MI code of its own to refetch the
// current composition from when only its own `standardBomId: Identity` is on
// hand (see `BomCompositionFactory`, which reads by MI code, not by id).
// `standardBomMiCode` exists for that reason alone: it is required *in
// practice* whenever `components` is also given, to reclone the current
// composition — enforced by the HTTP DTO (`@ValidateIf` on `components`) and,
// defensively, by `EditBomHandler` itself for any caller that bypasses the
// DTO — but it never changes what the `Bom`'s own `standardBomId` resolves
// to: `Bom.edit()` never reassigns it. See
// src/modules/boms/CLAUDE.md.
export class EditBomCommand {
  constructor(
    public readonly bomId: Identity,
    public readonly editorRole: Role | null,
    public readonly editedBy: string,
    public readonly editSource: BomEditSource,
    public readonly editReason: string | undefined,
    public readonly orderNumber?: OrderNumber,
    public readonly trackingNumber?: TrackingNumber,
    public readonly description?: string,
    public readonly components?: BomComponentInput[],
    public readonly standardBomMiCode?: string,
  ) {}
}
