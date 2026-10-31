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
import { CheckboxFilterList } from '../checkbox-filter-list/checkbox-filter-list';
import { DialogHead } from '../dialog-head/dialog-head';
import { Icon } from '../icon/icon';

/** One value the column can be filtered by, and the words the visitor reads for it. */
export interface CheckboxFilterDialogOption {
  readonly value: string;
  readonly label: string;
}

export interface CheckboxFilterDialogData {
  readonly fieldLabel: string;
  readonly options: readonly CheckboxFilterDialogOption[];
  /** `undefined` means every value counts as selected — no filter applied to this field yet. */
  readonly selectedValues: readonly string[] | undefined;
}

/** What this dialog closes with. `undefined` (no object at all) means the user cancelled;
 * `{ selected: undefined }` means "every value ended up checked", which the caller must treat as an
 * *absent* filter, never as the full list of values. */
export interface CheckboxFilterDialogResult {
  readonly selected: string[] | undefined;
}

/**
 * The Excel-style column filter: a title naming the column, the searchable checkbox list
 * (`app-checkbox-filter-list`) with its «انتخاب همه», and «پاک کردن» / «انصراف» / «اعمال». One dialog
 * for every checkbox-filtered column of the daily-BOM report (`/boms`) and for the daily-BOM
 * dashboard's approval filters, so the two read and behave alike.
 *
 * Each option carries a value and a label: most columns show the value itself, but a column whose
 * values are technical (an approval status) shows its Persian label and still hands back the value.
 *
 * A `MatDialog` rather than a `mat-menu`: the panel holds a "select all" checkbox plus one checkbox
 * per value, none of which are `mat-menu-item`s, and a `role="menu"` container requires menuitem-
 * shaped children to stay ARIA-valid.
 */
@Component({
  selector: 'app-checkbox-filter-dialog',
  imports: [
    CheckboxFilterList,
    DialogHead,
    Icon,
    MatButton,
    MatDialogActions,
    MatDialogClose,
    MatDialogContent,
    MatIcon,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <app-dialog-head [heading]="'فیلتر ' + data.fieldLabel" [subtitle]="summary()" />

    <mat-dialog-content>
      <app-checkbox-filter-list [options]="options" [(selected)]="checked" />
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
  styleUrl: './checkbox-filter-dialog.scss',
})
export class CheckboxFilterDialog {
  private readonly dialogRef = inject(
    MatDialogRef<CheckboxFilterDialog, CheckboxFilterDialogResult>,
  );
  protected readonly data = inject<CheckboxFilterDialogData>(MAT_DIALOG_DATA);

  protected readonly options = this.data.options;

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
