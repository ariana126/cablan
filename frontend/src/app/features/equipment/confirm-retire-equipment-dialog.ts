import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { MatButton } from '@angular/material/button';
import {
  MAT_DIALOG_DATA,
  MatDialogActions,
  MatDialogContent,
  MatDialogRef,
} from '@angular/material/dialog';
import { firstValueFrom } from 'rxjs';

import { AppEquipment, EquipmentGateway } from '../../core/maintenance/equipment-gateway';
import { ConfirmHead } from '../../ui/confirm-head/confirm-head';
import { ErrorBanner } from '../../ui/error-banner/error-banner';
import { mapRetireError } from './server-errors';

export interface ConfirmRetireEquipmentDialogData {
  readonly equipment: AppEquipment;
}

/**
 * Retiring stops a piece of equipment's whole PM plan for good — there is no reinstating it — so it
 * is a blocking decision, confirmed like a delete. Its history stays.
 */
@Component({
  selector: 'app-confirm-retire-equipment-dialog',
  imports: [ConfirmHead, ErrorBanner, MatButton, MatDialogActions, MatDialogContent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <app-confirm-head heading="کنار گذاشتن تجهیز">
      تجهیز «{{ data.equipment.name }}» کنار گذاشته می‌شود و برنامهٔ PM آن متوقف می‌شود. سابقهٔ
      تعمیرات آن حفظ می‌شود. این کار قابل بازگشت نیست.
    </app-confirm-head>

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
        [disabled]="retiring()"
        (click)="onConfirm()"
      >
        کنار گذاشتن تجهیز
      </button>
    </mat-dialog-actions>
  `,
  styleUrl: './confirm-retire-equipment-dialog.scss',
})
export class ConfirmRetireEquipmentDialog {
  private readonly dialogRef = inject(MatDialogRef<ConfirmRetireEquipmentDialog, boolean>);
  protected readonly data = inject<ConfirmRetireEquipmentDialogData>(MAT_DIALOG_DATA);
  private readonly gateway = inject(EquipmentGateway);

  protected readonly retiring = signal(false);
  protected readonly error = signal('');

  protected async onConfirm(): Promise<void> {
    this.retiring.set(true);
    this.error.set('');
    try {
      await firstValueFrom(this.gateway.retire(this.data.equipment.id));
      this.dialogRef.close(true);
    } catch (retireError) {
      this.error.set(mapRetireError(retireError));
    } finally {
      this.retiring.set(false);
    }
  }

  protected onCancel(): void {
    this.dialogRef.close(false);
  }
}
