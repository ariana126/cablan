/**
 * Folds a string to the form two people would agree is "the same text" when searching.
 *
 * Persian text reaches the app through keyboards, pastes and spreadsheets that disagree on small
 * things the reader never notices: Arabic `ي`/`ك` against Persian `ی`/`ک`, Persian `۱۲۳` against
 * Arabic-Indic `١٢٣` against Latin `123`, a stray tatweel, diacritics, a zero-width non-joiner
 * (`می‌شود` against `میشود`). Both sides of a comparison go through this so none of those make a
 * value unfindable. Latin letters are case-folded.
 *
 * Search-only: never use the folded text for display or for anything sent to the backend.
 */

const CHARACTER_MAP: Readonly<Record<string, string>> = {
  ي: 'ی',
  ى: 'ی',
  ك: 'ک',
  ة: 'ه',
  ۀ: 'ه',
  أ: 'ا',
  إ: 'ا',
  آ: 'ا',
};

const PERSIAN_ZERO = 0x06f0;
const ARABIC_INDIC_ZERO = 0x0660;

/** Diacritics (any non-spacing mark), tatweel (U+0640) and ZWNJ/ZWJ/LRM/RLM (U+200C–U+200F) — all noise to a search. */
const IGNORABLE = /\p{Mn}|\u0640|[\u200C-\u200F]/gu;

export const normalizeForSearch = (text: string): string =>
  text
    .normalize('NFKC')
    .replace(IGNORABLE, '')
    .replace(/[۰-۹٠-٩]/g, (digit) => {
      const code = digit.charCodeAt(0);
      return String(code >= PERSIAN_ZERO ? code - PERSIAN_ZERO : code - ARABIC_INDIC_ZERO);
    })
    .replace(/[يىكةۀأإآ]/g, (character) => CHARACTER_MAP[character])
    .toLowerCase()
    .trim();

/** Whether `text` contains `query`, once both are folded. An empty query matches everything. */
export const matchesSearch = (text: string, query: string): boolean =>
  normalizeForSearch(text).includes(normalizeForSearch(query));
