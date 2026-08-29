// Takes the MI code as a plain string, mirroring `GetStandardBomByMiCodeQuery`.
// The detail dialog's "view details" link is identified by MI code from the
// list view, not by an internal id.
export class GetStandardBomDetailQuery {
  constructor(public readonly miCode: string) {}
}
