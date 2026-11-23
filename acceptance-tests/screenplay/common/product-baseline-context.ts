/**
 * What the byte-identical «محصول «…» بدون تغییر در سیستم ثبت شده باشد» compares a product with.
 *
 * Issue #128 says it of a product just registered through the browser, so the product is measured
 * against what was registered (`as-registered`: the attempt `product-details.ts` remembers). Issue
 * #133 says it of the source of a «تعریف محصول مشابه», which a precondition registered and the
 * scenario never re-states, so the product is measured against how it stood just before the action
 * (`as-noted`: `similar-product.ts#NoteTheProduct`).
 *
 * Set explicitly by every owning step, so no scenario inherits another's.
 */
export type ProductBaseline = 'as-registered' | 'as-noted';

let current: ProductBaseline = 'as-registered';

export const theProductIsMeasuredAgainst = (
  baseline: ProductBaseline,
): void => {
  current = baseline;
};

export const whatTheProductIsMeasuredAgainst = (): ProductBaseline => current;
