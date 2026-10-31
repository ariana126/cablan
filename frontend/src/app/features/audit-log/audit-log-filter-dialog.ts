import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { MatButton } from '@angular/material/button';
import {
  MAT_DIALOG_DATA,
  MatDialogActions,
  MatDialogClose,
  MatDialogContent,
  MatDialogRef,
} from '@angular/material/dialog';
import { MatIcon } from '@angular/material/icon';

import { formatPersianNumber } from '../../core/i18n/persian-numerals';
import { DialogHead } from '../../ui/dialog-head/dialog-head';
import {
  CheckboxFilterList,
  CheckboxFilterOption,
} from '../../ui/checkbox-filter-list/checkbox-filter-list';
import { Icon } from '../../ui/icon/icon';

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
    DialogHead,
    MatDialogActions,
    MatDialogClose,
    MatDialogContent,
    Icon,
    MatIcon,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <app-dialog-head [heading]="'فیلتر ' + data.fieldLabel" [subtitle]="summary()" />

    <mat-dialog-content>
      <app-checkbox-filter-list [options]="data.options" [(selected)]="checked" />
    </mat-dialog-content>

    <!-- «پاک کردن» lifts the filter outright; «انصراف» and the filled «اعمال» are the usual pair. -->
    <mat-dialog-actions class="dialog-footer dialog-footer--split">
      <button matButton type="button" (click)="onClear()">
        <mat-icon appIcon="clear" />پاک کردن
      </button>
      <span class="dialog-footer__group">
        <button matButton type="button" mat-dialog-close>
          <mat-icon appIcon="cancel" />انصراف
        </button>
        <button matButton="filled" type="button" (click)="onApply()">
          <mat-icon appIcon="filter" />اعمال
        </button>
      </span>
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

  /** «۱ از ۲ انتخاب شده», or that nothing is chosen. */
  protected readonly summary = computed(() => {
    const chosen = this.checked().size;
    return chosen === 0
      ? 'هیچ مقداری انتخاب نشده'
      : `${formatPersianNumber(chosen)} از ${formatPersianNumber(this.allValues.length)} انتخاب شده`;
  });

  /** Removes the filter: every value counts as selected again, which the caller sends as no filter. */
  protected onClear(): void {
    this.dialogRef.close({ selected: undefined });
  }

  protected onApply(): void {
    const checked = this.checked();
    const selected =
      checked.size === this.allValues.length
        ? undefined
        : this.allValues.filter((value) => checked.has(value));

    this.dialogRef.close({ selected });
  }
}
