import { Identity } from '@framework/domain';

import { BomComponentLine } from './bom-component-line.vo';

/**
 * The standard BOM a daily BOM is cloned from, as the daily BOM keeps it:
 * its id and the reporting fields copied from it (ADR 0004). Fixed at
 * registration, and changed only by an edit re-pointing the daily BOM at
 * another MI code of the same product on its order (issue #101).
 */
export interface StandardBomClone {
  readonly standardBomId: Identity;
  readonly miCode: string;
  readonly brand: string;
  readonly productName: string;
  readonly standardLength: number;
}

/**
 * An edit re-pointing a daily BOM at another standard BOM
 * (`Bom.editRepointed()`): that standard BOM, and the composition cloned
 * from it — one value, so a re-pointing without its composition cannot be
 * built.
 */
export interface BomRepointing {
  readonly standardBom: StandardBomClone;
  readonly components: BomComponentLine[];
}
