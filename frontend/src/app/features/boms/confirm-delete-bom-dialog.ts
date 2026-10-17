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

import { BomsGateway } from '../../core/boms/boms-gateway';
import { ErrorBanner } from '../../ui/error-banner/error-banner';
import { mapDeleteError } from './server-errors';

/**
 * Only the two fields the confirmation actually needs — the id it deletes by and the order number
 * it names in the prompt. Deliberately NOT an `AppBom`: the delete button on the merged
 * `/boms` page acts on a report row (`AppBomReportRow`) and on the detail card
 * (`AppBomDetail`), neither of which is one, and neither of which is worth fetching a full
 * `AppBom` for just to throw everything but these two fields away.
 */
export interface ConfirmDeleteBomTarget {
  readonly id: string;
  readonly orderNumber: string;
}

export interface ConfirmDeleteBomDialogData {
  readonly bom: ConfirmDeleteBomTarget;
}

/**
 * A blocking decision, per the design system's dialog-vs-snackbar guidance: deleting a daily BOM is
 * destructive and has to be acknowledged, not merely undoable after the fact.
 */
@Component({
  selector: 'app-confirm-delete-bom-dialog',
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
        <h2 mat-dialog-title class="confirm-head__title">حذف آنالیز روزانه</h2>
        <p class="confirm-head__body">
          آنالیز روزانه با شماره سفارش «{{ data.bom.orderNumber }}» و همهٔ وزن‌های ثبت‌شدهٔ آن حذف
          می‌شود. این کار قابل بازگشت نیست.
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
  styleUrl: './confirm-delete-bom-dialog.scss',
})
export class ConfirmDeleteBomDialog {
  private readonly dialogRef = inject(MatDialogRef<ConfirmDeleteBomDialog, boolean>);
  protected readonly data = inject<ConfirmDeleteBomDialogData>(MAT_DIALOG_DATA);
  private readonly bomsGateway = inject(BomsGateway);

  protected readonly deleting = signal(false);
  protected readonly error = signal('');

  protected async onConfirm(): Promise<void> {
    this.deleting.set(true);
    this.error.set('');

    try {
      await firstValueFrom(this.bomsGateway.delete(this.data.bom.id));
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
