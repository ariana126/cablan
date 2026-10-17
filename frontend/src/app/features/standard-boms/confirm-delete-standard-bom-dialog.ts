import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { MatButton } from '@angular/material/button';
import {
  MAT_DIALOG_DATA,
  MatDialogActions,
  MatDialogContent,
  MatDialogRef,
  MatDialogTitle,
} from '@angular/material/dialog';
import { MatIcon } from '@angular/material/icon';
import { firstValueFrom } from 'rxjs';

import { StandardBomsGateway } from '../../core/standard-boms/standard-boms-gateway';
import { ErrorBanner } from '../../ui/error-banner/error-banner';
import { mapDeleteError } from './server-errors';

/**
 * Only the two fields the confirmation actually needs — the id it deletes by and the MI code it
 * names in the prompt. Deliberately NOT an `AppStandardBom`: the delete button on the merged
 * `/standard-boms` page acts on a report row (`AppStandardBomReportRow`) and on the detail card
 * (`AppStandardBomDetail`), neither of which is one.
 */
export interface ConfirmDeleteStandardBomTarget {
  readonly id: string;
  readonly miCode: string;
}

export interface ConfirmDeleteStandardBomDialogData {
  readonly standardBom: ConfirmDeleteStandardBomTarget;
}

/**
 * A blocking decision, per the design system's dialog-vs-snackbar guidance: deleting a Standard BOM
 * is destructive and has to be acknowledged, not merely undoable after the fact.
 */
@Component({
  selector: 'app-confirm-delete-standard-bom-dialog',
  imports: [ErrorBanner, MatButton, MatDialogActions, MatDialogContent, MatDialogTitle, MatIcon],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <!-- No close button: the choice is cancel or delete. -->
    <div class="confirm-head">
      <span class="dialog-icon-tile">
        <mat-icon>
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
            stroke-linecap="round"
            stroke-linejoin="round"
          >
            <path d="M4 7h16M10 11v6M14 11v6" />
            <path d="M6 7l1 13h10l1-13M9 7V4h6v3" />
          </svg>
        </mat-icon>
      </span>
      <div class="stack stack--hair">
        <h2 mat-dialog-title class="confirm-head__title">حذف آنالیز استاندارد</h2>
        <p class="confirm-head__body">
          آنالیز استاندارد با کد MI «{{ data.standardBom.miCode }}» و ترکیب آن حذف می‌شود. این کار
          قابل بازگشت نیست.
        </p>
      </div>
    </div>

    @if (error()) {
      <mat-dialog-content>
        <app-error-banner [message]="error()" />
      </mat-dialog-content>
    }

    <mat-dialog-actions class="dialog-footer">
      <button matButton type="button" cdkFocusInitial (click)="onCancel()">انصراف</button>
      <button
        matButton="filled"
        class="danger"
        type="button"
        [disabled]="deleting()"
        (click)="onConfirm()"
      >
        حذف آنالیز
      </button>
    </mat-dialog-actions>
  `,
  styleUrl: './confirm-delete-standard-bom-dialog.scss',
})
export class ConfirmDeleteStandardBomDialog {
  private readonly dialogRef = inject(MatDialogRef<ConfirmDeleteStandardBomDialog, boolean>);
  protected readonly data = inject<ConfirmDeleteStandardBomDialogData>(MAT_DIALOG_DATA);
  private readonly standardBomsGateway = inject(StandardBomsGateway);

  protected readonly deleting = signal(false);
  protected readonly error = signal('');

  protected async onConfirm(): Promise<void> {
    this.deleting.set(true);
    this.error.set('');

    try {
      await firstValueFrom(this.standardBomsGateway.delete(this.data.standardBom.id));
      this.dialogRef.close(true);
    } catch (deleteError) {
      this.error.set(mapDeleteError(deleteError));
    } finally {
      this.deleting.set(false);
    }
  }

  protected onCancel(): void {
    this.dialogRef.close(false);
  }
}
