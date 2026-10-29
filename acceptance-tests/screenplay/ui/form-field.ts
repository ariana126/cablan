import { includes } from '@serenity-js/assertions';
import { By, PageElement, PageElements, Text } from '@serenity-js/web';

/**
 * The `<mat-form-field>` whose `<mat-label>` reads `label` — the anchor a field-scoped
 * `<mat-error>` (or an input whose role is not known in advance) is reached through. The same
 * device `materials-page.ts` uses privately; shared here for the maintenance pages, whose forms
 * each have more than one field that can fail on its own.
 *
 * Anchors on Angular Material's own `mat-form-field`/`mat-label` elements, which the accessibility
 * gate does NOT protect; the label text itself is gated (every input needs its label). `includes`
 * rather than `equals` tolerates surrounding whitespace and Material's required-marker asterisk —
 * so no two labels on one form may contain one another.
 */
export const formFieldLabelled = (label: string) =>
  PageElements.located(By.css('mat-form-field'))
    .where(Text.of(PageElement.located(By.css('mat-label'))), includes(label))
    .first()
    .describedAs(`"${label}" form field`);

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
