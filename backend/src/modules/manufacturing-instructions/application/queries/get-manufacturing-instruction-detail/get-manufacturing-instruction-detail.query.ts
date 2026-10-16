// Takes the MI code as a plain string, mirroring `GetManufacturingInstructionByMiCodeQuery`.
// The detail dialog's "view details" link is identified by MI code from the
// list view, not by an internal id.
export class GetManufacturingInstructionDetailQuery {
  constructor(public readonly miCode: string) {}
}
