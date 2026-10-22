import { fromRenderedNumber } from './persian-digits';

/**
 * Reading the frontend's weight-difference pill — the arrow-and-colour cell under «اختلاف وزن»
 * that both the dashboard's per-product panel and the daily BOM preview render the same way.
 *
 * A non-zero difference is the absolute value inside a pill with a direction arrow and, for a
 * screen reader, visually hidden words («بیشتر از استاندارد» / «کمتر از استاندارد»). The arrow is
 * an `aria-hidden` SVG, so the cell's text is the Persian number followed by those words.
 */

/**
 * The weight difference a «اختلاف وزن» cell shows, in plain Latin notation. Only the number is
 * read; the direction words are not part of the quantity.
 *
 * **An empty cell reads as "0".** The page leaves the cell blank — no pill, no text — when a line
 * matches its standard weight exactly (GitHub issue #38), so the eye lands only on deviations.
 * Blank is how the page says "no deviation", and a rule's table writes that same fact as `0`. A
 * cell with text but no number is handed back verbatim, so it fails loudly rather than passing as
 * some quantity.
 */
export const differenceShownIn = (cellText: string): string => {
  const quantity = cellText.match(/[0-9۰-۹٠-٩][0-9۰-۹٠-٩٫٬.]*/);
  if (quantity) {
    return fromRenderedNumber(quantity[0]);
  }
  return cellText.trim() === '' ? '0' : cellText.trim();
};

export const ABOVE_STANDARD = 'بیشتر از استاندارد';
export const BELOW_STANDARD = 'کمتر از استاندارد';

/**
 * The direction a «اختلاف وزن» cell states, as its visually hidden words name it — the same words
 * a Gherkin table writes under «جهت اختلاف». An empty string for a cell that names neither (a
 * blank, zero-difference cell).
 */
export const directionShownIn = (cellText: string): string => {
  if (cellText.includes(ABOVE_STANDARD)) {
    return ABOVE_STANDARD;
  }
  if (cellText.includes(BELOW_STANDARD)) {
    return BELOW_STANDARD;
  }
  return '';
};
