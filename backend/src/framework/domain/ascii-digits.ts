// The digits a Persian keyboard types, zero to nine: a digit's index in its
// block is its value.
const PERSIAN_DIGITS = '۰۱۲۳۴۵۶۷۸۹';
const ARABIC_INDIC_DIGITS = '٠١٢٣٤٥٦٧٨٩';
const TYPED_DIGIT = /[۰-۹٠-٩]/g;

/**
 * Rewrites every Persian (U+06F0–06F9) or Arabic-Indic (U+0660–0669) digit in
 * `text` as its English digit and leaves every other character as it is, so
 * «۱۲۳۴» and «1234» are one value. Applied by the value objects (and aggregate
 * fields) that hold identifiers and free text a person types, where they are
 * constructed.
 */
export function toAsciiDigits(text: string): string {
  return text.replaceAll(TYPED_DIGIT, (digit) =>
    String(
      Math.max(
        PERSIAN_DIGITS.indexOf(digit),
        ARABIC_INDIC_DIGITS.indexOf(digit),
      ),
    ),
  );
}
