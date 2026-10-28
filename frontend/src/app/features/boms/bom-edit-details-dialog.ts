import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { MAT_DIALOG_DATA, MatDialogContent } from '@angular/material/dialog';

import { AppBomEditRecord } from '../../core/boms/bom-edit-history';
import { DialogHead } from '../../ui/dialog-head/dialog-head';
import { EditHistory } from '../../ui/edit-history/edit-history';

export interface BomEditDetailsDialogData {
  readonly orderNumber: string;
  readonly editHistory: readonly AppBomEditRecord[];
}

/**
 * «جزئیات ویرایش» — every correction made to one daily BOM, read straight off its report row (no
 * request): each edit's heading line, then one line per change. Read-only, so offered to every
 * role; the head's close button and Escape dismiss it.
 */
@Component({
  selector: 'app-bom-edit-details-dialog',
  imports: [DialogHead, EditHistory, MatDialogContent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <app-dialog-head heading="جزئیات ویرایش" [subtitle]="'شماره سفارش ' + data.orderNumber" />

    <mat-dialog-content>
      <app-edit-history label="جزئیات ویرایش" [history]="data.editHistory" />
    </mat-dialog-content>
  `,
  styleUrl: './bom-edit-details-dialog.scss',
})
export class BomEditDetailsDialog {
  protected readonly data = inject<BomEditDetailsDialogData>(MAT_DIALOG_DATA);
}
