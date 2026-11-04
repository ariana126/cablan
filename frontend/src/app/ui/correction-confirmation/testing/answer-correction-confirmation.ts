import { TestBed } from '@angular/core/testing';
import { MatDialog, MatDialogRef } from '@angular/material/dialog';
import { of } from 'rxjs';
import { vi } from 'vitest';

import { CorrectionConfirmationDialog } from '../correction-confirmation-dialog';

/**
 * For an edit dialog's spec: the System Admin's answer to the correction confirmation, given as
 * soon as it opens — `true` for «تایید», `false` for «انصراف», `undefined` for closing it. Returns
 * the `MatDialog.open` spy, so a spec can say it was (or was not) asked, and with what.
 */
export function answerCorrectionConfirmation(answer: boolean | undefined) {
  const dialog = TestBed.inject(MatDialog);
  const open = dialog.open.bind(dialog);
  return vi
    .spyOn(dialog, 'open')
    .mockImplementation(((component: unknown, config?: object) =>
      component === CorrectionConfirmationDialog
        ? ({ afterClosed: () => of(answer) } as MatDialogRef<unknown, unknown>)
        : open(component as never, config)) as typeof dialog.open);
}

/** Whether `open` (the spy above) was asked to show the correction confirmation. */
export const askedToConfirm = (open: ReturnType<typeof answerCorrectionConfirmation>): boolean =>
  open.mock.calls.some(([component]) => component === CorrectionConfirmationDialog);
