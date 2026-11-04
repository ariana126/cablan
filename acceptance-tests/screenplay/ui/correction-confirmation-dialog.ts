import { By, PageElement } from '@serenity-js/web';

/**
 * Lean Page Object for the System Admin's correction confirmation (issue #110): when an edit of a
 * record other records use is refused (409 `record-has-dependents`) and the visitor is the System
 * Admin and changed only correctable fields (a name, a material's code), the edit dialog opens this
 * second dialog on top of itself — naming the dependents and saying the change applies to every
 * related record and history. «تایید» re-sends the edit with `applyToRelatedRecords: true`;
 * «انصراف» (or closing it) changes nothing. It is the same widget on all five edit dialogs
 * (material, product, component, equipment, activity), so it lives here once.
 *
 * Confirmed against source (`frontend/src/app/ui/correction-confirmation/`), not yet against a
 * rendered page: a `mat-dialog` (role `dialog`) named by its `mat-dialog-title` «اعمال در اطلاعات و
 * سوابق مرتبط», with «انصراف» and «تایید» in its footer and a «بستن» close button in its header
 * (closing, like «انصراف», sends nothing). The edit dialog stays open underneath it, so both dialogs are in the
 * overlay at once — which is why everything here is scoped to *this* dialog by its name, never to
 * "the open dialog".
 */
const dialog = () =>
  PageElement.located(
    By.role('dialog', {
      name: 'اعمال در اطلاعات و سوابق مرتبط',
      exact: true,
    }),
  ).describedAs('correction confirmation dialog');

export const CorrectionConfirmationDialog = {
  dialog,

  /** «تایید» — apply the correction to every related record. */
  confirmButton: () =>
    PageElement.located(By.role('button', { name: 'تایید', exact: true }))
      .of(dialog())
      .describedAs('confirm correction button'),

  /** «انصراف» — leave everything as it was. */
  cancelButton: () =>
    PageElement.located(By.role('button', { name: 'انصراف', exact: true }))
      .of(dialog())
      .describedAs('cancel correction button'),
};
