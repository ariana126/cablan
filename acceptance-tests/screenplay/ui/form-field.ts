import { By, PageElement } from '@serenity-js/web';

/**
 * `text` as an XPath 1.0 string literal. XPath has no escape character, so a text holding both
 * quote kinds is spelled as a `concat()` of pieces.
 */
const xpathLiteral = (text: string): string => {
  if (!text.includes("'")) {
    return `'${text}'`;
  }
  if (!text.includes('"')) {
    return `"${text}"`;
  }
  return `concat(${text
    .split("'")
    .map((piece) => `'${piece}'`)
    .join(`, "'", `)})`;
};

/**
 * The first `<mat-form-field>` (in document order) holding a `<mat-label>` that satisfies
 * `labelTest` — an XPath predicate over the label's whitespace-normalised text, `normalize-space(.)`.
 *
 * One XPath, evaluated by the browser in a single pass. Deliberately **not** a Serenity list
 * filter (`PageElements.located('mat-form-field').where(Text.of(mat-label), …)`): that reads each
 * field's label with Playwright's `innerText`, one item at a time, and `innerText` auto-waits up to
 * 30 s for an item that is gone — a dialog that closes while a «… answered» poll is mid-filter
 * leaves `mat-form-field.nth(1)` pointing at nothing, and the poll hung for 30 s instead of seeing
 * the dialog had closed (recording-maintenance-execution, CI run 42073156051). Matching nothing,
 * this locator simply reports "not present / not visible" at once.
 */
const firstFormFieldWhoseLabel = (labelTest: string, description: string) =>
  PageElement.located(
    By.xpath(`(//mat-form-field[.//mat-label[${labelTest}]])[1]`),
  ).describedAs(description);

/**
 * The `<mat-form-field>` whose `<mat-label>` reads exactly `label` — the anchor a field-scoped
 * `<mat-error>` (or an input whose role is not known in advance) is reached through. Shared by the
 * maintenance pages, whose forms each have more than one field that can fail on its own.
 *
 * Anchors on Angular Material's own `mat-form-field`/`mat-label` elements, which the accessibility
 * gate does NOT protect; the label text itself is gated (every input needs its label). The label
 * is matched **whole**, tolerating only surrounding whitespace and Material's required-marker
 * asterisk. Not "contains": CSS sees every form field on the page, including the ones the dialog's
 * overlay hides, and a list page's search field («جستجوی نام تجهیز») sits before the dialog in the
 * DOM and contains the form's label («نام تجهیز») — "contains" picked it, and its never-shown error.
 */
export const formFieldLabelled = (label: string) => {
  const text = 'normalize-space(.)';
  return firstFormFieldWhoseLabel(
    [label, `${label}*`, `${label} *`]
      .map((accepted) => `${text}=${xpathLiteral(accepted)}`)
      .join(' or '),
    `"${label}" form field`,
  );
};

/**
 * The `<mat-form-field>` whose `<mat-label>` contains `label` — for a form whose labels never
 * contain one another (`materials-page.ts`: «کد مواد اولیه», «اسم مواد اولیه»), so containing is
 * as precise as reading whole. Same single-pass lookup as `formFieldLabelled`.
 */
export const formFieldWhoseLabelContains = (label: string) =>
  firstFormFieldWhoseLabel(
    `contains(normalize-space(.), ${xpathLiteral(label)})`,
    `"${label}" form field`,
  );

/** The `<mat-error>` of the field labelled `label`. */
export const errorOfFieldLabelled = (label: string) =>
  PageElement.located(By.css('mat-error'))
    .of(formFieldLabelled(label))
    .describedAs(`"${label}" error message`);

/**
 * The `<input>` or `<textarea>` of the field labelled `label`, whatever its role — a
 * `type="number"` input is a `spinbutton`, a text one a `textbox`, and the label is the contract.
 */
export const inputOfFieldLabelled = (label: string) =>
  PageElement.located(By.css('input, textarea'))
    .of(formFieldLabelled(label))
    .describedAs(`"${label}" field`);
