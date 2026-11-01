import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { MAT_DIALOG_DATA, MatDialogContent, MatDialogRef } from '@angular/material/dialog';

import { AppPmOccurrence } from '../../core/maintenance/pm-schedule-gateway';
import { DialogHead } from '../../ui/dialog-head/dialog-head';
import { PmOccurrenceChip } from './pm-occurrence-chip';

export interface PmDayOccurrencesDialogData {
  /** The day as a visitor reads it, «۱۴۰۵/۰۸/۰۳». */
  readonly day: string;
  readonly occurrences: readonly AppPmOccurrence[];
}

/**
 * A busy calendar day in full — what its «+N مورد دیگر» opens: every occurrence of the day as the
 * same chip the cell shows. Choosing one closes this dialog **with** that occurrence, and the
 * calendar opens its details in its place, so only one dialog is ever open at a time.
 */
@Component({
  selector: 'app-pm-day-occurrences-dialog',
  imports: [DialogHead, MatDialogContent, PmOccurrenceChip],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <app-dialog-head [heading]="'موعدهای ' + data.day" />

    <mat-dialog-content>
      <ul class="day-occurrences">
        @for (occurrence of data.occurrences; track $index) {
          <li><app-pm-occurrence-chip [occurrence]="occurrence" (choose)="open(occurrence)" /></li>
        }
      </ul>
    </mat-dialog-content>
  `,
  styleUrl: './pm-day-occurrences-dialog.scss',
})
export class PmDayOccurrencesDialog {
  protected readonly data = inject<PmDayOccurrencesDialogData>(MAT_DIALOG_DATA);
  private readonly dialogRef =
    inject<MatDialogRef<PmDayOccurrencesDialog, AppPmOccurrence>>(MatDialogRef);

  protected open(occurrence: AppPmOccurrence): void {
    this.dialogRef.close(occurrence);
  }
}
