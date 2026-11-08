import { matchesSearch } from '../../core/i18n/search-normalizer';
import { AppProduct } from '../../core/products/products-gateway';
import { AppStandardBom } from '../../core/standard-boms/standard-boms-gateway';

/** An MI code the order dialogs offer: a standard BOM's code and the name of its product. */
export interface MiCodeOption {
  readonly miCode: string;
  /** `''` when the product is not among those read. */
  readonly productName: string;
}

/** Every standard BOM as an option, named by its product. */
export function miCodeOptions(
  standardBoms: readonly AppStandardBom[],
  products: readonly AppProduct[],
): MiCodeOption[] {
  const names = new Map(products.map((product) => [product.id, product.name]));
  return standardBoms.map((standardBom) => ({
    miCode: standardBom.miCode,
    productName: names.get(standardBom.productId) ?? '',
  }));
}

/** How an option reads: the code first («1001 — کابل 2.5»), the identifier the visitor was given,
 * then the product that tells codes apart. */
export function miCodeOptionLabel(option: MiCodeOption): string {
  return option.productName === '' ? option.miCode : `${option.miCode} — ${option.productName}`;
}

/**
 * What an MI-code autocomplete offers: the options not already chosen, narrowed to those whose code
 * or product name contains what is typed (folded like every search, so «۱۰۰۲» finds «1002»).
 */
export function offeredMiCodes(
  options: readonly MiCodeOption[],
  query: string,
  chosen: readonly string[],
): MiCodeOption[] {
  return options.filter(
    (option) =>
      !chosen.includes(option.miCode) &&
      (matchesSearch(option.miCode, query) || matchesSearch(option.productName, query)),
  );
}
