import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { MatButton } from '@angular/material/button';
import {
  MAT_DIALOG_DATA,
  MatDialogActions,
  MatDialogClose,
  MatDialogContent,
  MatDialogRef,
  MatDialogTitle,
} from '@angular/material/dialog';

import {
  CheckboxFilterList,
  CheckboxFilterOption,
} from '../../ui/checkbox-filter-list/checkbox-filter-list';

export interface AuditLogFilterDialogData {
  readonly fieldLabel: string;
  /** Every value the log holds for this field, each with the words the visitor reads. */
  readonly options: readonly CheckboxFilterOption<string>[];
  /** `undefined` means every value counts as selected — no filter applied to this field yet. */
  readonly selectedValues: readonly string[] | undefined;
}

/** What this dialog closes with. `undefined` (no object at all) means the user cancelled;
 * `{ selected: undefined }` means "every value ended up checked", which the caller must send to the
 * backend as an *absent* filter key; `{ selected: [] }` means nothing is checked, which matches
 * nothing. */
export interface AuditLogFilterDialogResult {
  readonly selected: string[] | undefined;
}

/**
 * The Excel-style value filter of one audit-log column (کاربر, نوع رکورد, نوع رویداد) — the same
 * dialog-around-`app-checkbox-filter-list` shape as the BOM report's filter dialog, except each
 * option carries a Persian label distinct from the value the backend knows.
 */
@Component({
  selector: 'app-audit-log-filter-dialog',
  imports: [
    MatButton,
    CheckboxFilterList,
    MatDialogActions,
    MatDialogClose,
    MatDialogContent,
    MatDialogTitle,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <h2 mat-dialog-title>فیلتر {{ data.fieldLabel }}</h2>

    <mat-dialog-content>
      <app-checkbox-filter-list [options]="data.options" [(selected)]="checked" />
    </mat-dialog-content>

    <mat-dialog-actions align="end">
      <button matButton type="button" mat-dialog-close>انصراف</button>
      <button matButton="filled" type="button" (click)="onApply()">اعمال فیلتر</button>
    </mat-dialog-actions>
  `,
  styleUrl: './audit-log-filter-dialog.scss',
})
export class AuditLogFilterDialog {
  private readonly dialogRef = inject(
    MatDialogRef<AuditLogFilterDialog, AuditLogFilterDialogResult>,
  );
  protected readonly data = inject<AuditLogFilterDialogData>(MAT_DIALOG_DATA);

  private readonly allValues = this.data.options.map((option) => option.value);

  protected readonly checked = signal<ReadonlySet<string>>(
    new Set(this.data.selectedValues ?? this.allValues),
  );

  protected onApply(): void {
    const checked = this.checked();
    const selected =
      checked.size === this.allValues.length
        ? undefined
        : this.allValues.filter((value) => checked.has(value));

    this.dialogRef.close({ selected });
  }
}
