import { AppStandardBom } from '../../core/standard-boms/standard-boms-gateway';

/** How a standard BOM reads as an MI code option: the code first («1001 — لگراند»), so a visitor
 * scanning the list reads the identifier they were given, then the brand that tells codes apart. */
export function miCodeOptionLabel(standardBom: AppStandardBom): string {
  return standardBom.brand === ''
    ? standardBom.miCode
    : `${standardBom.miCode} — ${standardBom.brand}`;
}
