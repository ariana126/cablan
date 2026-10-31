import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { MatButton } from '@angular/material/button';
import {
  MAT_DIALOG_DATA,
  MatDialogActions,
  MatDialogContent,
  MatDialogRef,
} from '@angular/material/dialog';
import { MatIcon } from '@angular/material/icon';
import { firstValueFrom } from 'rxjs';

import { BomsGateway } from '../../core/boms/boms-gateway';
import { ConfirmHead } from '../../ui/confirm-head/confirm-head';
import { ErrorBanner } from '../../ui/error-banner/error-banner';
import { mapDeleteError } from './server-errors';
import { Icon } from '../../ui/icon/icon';

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
  imports: [ConfirmHead, ErrorBanner, Icon, MatButton, MatDialogActions, MatDialogContent, MatIcon],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <app-confirm-head heading="حذف آنالیز روزانه">
      آنالیز روزانه با شماره سفارش «{{ data.bom.orderNumber }}» و همهٔ وزن‌های ثبت‌شدهٔ آن حذف
      می‌شود. این کار قابل بازگشت نیست.
    </app-confirm-head>

    @if (error()) {
      <mat-dialog-content>
        <app-error-banner [message]="error()" />
      </mat-dialog-content>
    }

    <mat-dialog-actions class="dialog-footer">
      <button matButton type="button" cdkFocusInitial (click)="onCancel()">
        <mat-icon appIcon="cancel" />انصراف
      </button>
      <button
        matButton="filled"
        class="danger"
        type="button"
        [disabled]="deleting()"
        (click)="onConfirm()"
      >
        <mat-icon appIcon="delete" />
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
