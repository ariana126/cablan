import { ApplicationException } from '@framework/application';

// Thrown when the `standardBomMiCode` a BOM registration or edit names does
// not resolve to an existing standard BOM — translated from
// `GetStandardBomByMiCodeQuery`'s `EntityNotFound` (a generic 404 from
// standard-boms' own point of view) into a 400 here, since a bad MI code in
// *this* request's own body is a defect in the request's content, not a
// conflict with existing state. See `BomCompositionFactory` and
// src/modules/boms/CLAUDE.md.
export class BomStandardBomNotFound extends ApplicationException {
  private constructor(
    message: string,
    public readonly standardBomMiCode: string,
  ) {
    super(message);
  }

  public static withMiCode(standardBomMiCode: string): BomStandardBomNotFound {
    return new BomStandardBomNotFound(
      `No standard BOM exists with MI code ${standardBomMiCode}`,
      standardBomMiCode,
    );
  }
}
