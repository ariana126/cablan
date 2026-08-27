// Takes the MI code as a plain string, deliberately: this is the one query
// `boms`' own `BomCompositionFactory` is allowed to dispatch through the
// `QueryBus` to read a standard BOM's current composition (see
// src/modules/boms/CLAUDE.md and .dependency-cruiser.cjs's
// `bom-composition-factory-reuse-is-narrow` rule), and that module must not
// import this module's own `MiCode` value object to build one. The
// conversion happens inside `GetStandardBomByMiCodeHandler`, this module's
// own code.
export class GetStandardBomByMiCodeQuery {
  constructor(public readonly miCode: string) {}
}
