import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { MatButton } from '@angular/material/button';
import { MatDialogActions, MatDialogRef, MatDialogTitle } from '@angular/material/dialog';
import { MatIcon } from '@angular/material/icon';

import { Icon } from '../../ui/icon/icon';

/**
 * Asked right after a new product is registered (issue #128): define its standard BOM now? The
 * whole sentence is the dialog's title, so it is also the dialog's accessible name. «بله، تعریف
 * آنالیز استاندارد» closes with `true`; «خیر» with `false`, Escape and the backdrop with nothing —
 * the products page treats all three alike.
 */
@Component({
  selector: 'app-offer-standard-bom-dialog',
  imports: [Icon, MatButton, MatDialogActions, MatDialogTitle, MatIcon],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="offer">
      <span class="offer__tile">
        <mat-icon appIcon="check-circle" />
      </span>
      <h2 mat-dialog-title class="offer__question">
        محصول با موفقیت ثبت شد. آیا می‌خواهید برای این محصول آنالیز استاندارد تعریف کنید؟
      </h2>
    </div>

    <mat-dialog-actions class="dialog-footer">
      <button matButton type="button" (click)="dialogRef.close(false)">
        <mat-icon appIcon="cancel" />خیر
      </button>
      <button matButton="filled" type="button" (click)="dialogRef.close(true)">
        <mat-icon appIcon="add" />بله، تعریف آنالیز استاندارد
      </button>
    </mat-dialog-actions>
  `,
  styleUrl: './offer-standard-bom-dialog.scss',
})
export class OfferStandardBomDialog {
  protected readonly dialogRef = inject(MatDialogRef<OfferStandardBomDialog, boolean>);
}
