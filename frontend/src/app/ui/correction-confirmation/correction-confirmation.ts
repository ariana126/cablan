import { Injectable, inject } from '@angular/core';
import { MatDialog } from '@angular/material/dialog';
import { firstValueFrom, Observable } from 'rxjs';

import { correctionConfirmationMessage } from '../../core/http/record-has-dependents';
import { CurrentUserStore } from '../../core/identity/current-user-store';
import { canCorrectRecordsInUse } from '../../core/identity/permissions';
import { CorrectionConfirmationDialog } from './correction-confirmation-dialog';

/** How a save ended without an error: it went through, or the System Admin declined the
 * correction and nothing was sent. */
export type CorrectionOutcome = 'saved' | 'declined';

/** An edit's body, with `applyToRelatedRecords: true` when it is the confirmed correction. */
export function withCorrection<T extends object>(
  body: T,
  applyToRelatedRecords: boolean,
): T & { applyToRelatedRecords?: true } {
  return applyToRelatedRecords ? { ...body, applyToRelatedRecords: true } : body;
}

/**
 * Issue #110's one exception to issue #94's rule, for the five edit dialogs that may correct a
 * record in use (a material's name and code, a product's, component's, equipment's or activity's
 * name). The API's 409 `record-has-dependents` **is** the prompt: when the visitor is the System
 * Admin and the edit changed only correctable fields, this asks them — naming where the record is
 * used — and on «تایید» sends the same edit again with `applyToRelatedRecords: true`. Declining sends
 * nothing. For anyone else, any other edit and any other refusal, the error goes back to the caller
 * unchanged, so its `server-errors.ts` shows it as before.
 */
@Injectable({ providedIn: 'root' })
export class CorrectionConfirmation {
  private readonly dialog = inject(MatDialog);
  private readonly currentUser = inject(CurrentUserStore);

  /**
   * @param send the edit, with or without the correction flag.
   * @param correctable whether the edit changed nothing but the record's correctable fields.
   * @param returnFocusTo where focus goes once the confirmation closes — a field of the edit
   *   dialog. Its submit button is disabled while the save is pending, so it cannot take focus back.
   * @throws whatever refused the edit, when no correction was offered or the corrected one failed.
   */
  async save(
    send: (applyToRelatedRecords: boolean) => Observable<unknown>,
    correctable: boolean,
    returnFocusTo?: HTMLElement | null,
  ): Promise<CorrectionOutcome> {
    try {
      await firstValueFrom(send(false));
      return 'saved';
    } catch (error) {
      const message = correctionConfirmationMessage(error);
      if (
        !correctable ||
        message === undefined ||
        !canCorrectRecordsInUse(this.currentUser.role())
      ) {
        throw error;
      }
      const confirmed = await firstValueFrom(
        this.dialog
          .open<CorrectionConfirmationDialog, unknown, boolean>(CorrectionConfirmationDialog, {
            data: { message },
            ...(returnFocusTo ? { restoreFocus: returnFocusTo } : {}),
          })
          .afterClosed(),
      );
      if (confirmed !== true) {
        return 'declined';
      }
      await firstValueFrom(send(true));
      return 'saved';
    }
  }
}
