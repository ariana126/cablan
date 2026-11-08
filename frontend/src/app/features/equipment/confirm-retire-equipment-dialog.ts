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

import { AppEquipment, EquipmentGateway } from '../../core/maintenance/equipment-gateway';
import { ConfirmHead } from '../../ui/confirm-head/confirm-head';
import { ErrorBanner } from '../../ui/error-banner/error-banner';
import { mapRetireError } from './server-errors';
import { Icon } from '../../ui/icon/icon';

export interface ConfirmRetireEquipmentDialogData {
  readonly equipment: AppEquipment;
}

/**
 * Retiring takes a piece of equipment out of service and stops its whole PM plan while it is
 * retired, so it is a blocking decision, confirmed like a delete. Its history stays, and only the
 * System Admin can reactivate it (issue #110) — so the text never calls it irreversible.
 */
@Component({
  selector: 'app-confirm-retire-equipment-dialog',
  imports: [ConfirmHead, ErrorBanner, Icon, MatButton, MatDialogActions, MatDialogContent, MatIcon],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <app-confirm-head heading="کنار گذاشتن تجهیز">
      تجهیز «{{ data.equipment.name }}» از وضعیت فعال خارج می‌شود و برنامهٔ PM آن تا زمانی که کنار
      گذاشته شده است متوقف می‌ماند. سابقهٔ تعمیرات آن حفظ می‌شود. فقط مدیر سیستم می‌تواند آن را
      دوباره فعال کند.
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
        [disabled]="retiring()"
        (click)="onConfirm()"
      >
        <mat-icon appIcon="block" />
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
