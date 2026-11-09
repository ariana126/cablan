import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { MatButton } from '@angular/material/button';
import {
  MAT_DIALOG_DATA,
  MatDialogActions,
  MatDialogClose,
  MatDialogContent,
  MatDialogRef,
} from '@angular/material/dialog';
import { MatIcon } from '@angular/material/icon';

import {
  CheckboxFilterList,
  CheckboxFilterOption,
  CheckboxFilterSelection,
} from '../checkbox-filter-list/checkbox-filter-list';
import { DialogHead } from '../dialog-head/dialog-head';
import { Icon } from '../icon/icon';

/** One value the column can be filtered by, and the words the visitor reads for it. */
export type CheckboxFilterDialogOption<V = string> = CheckboxFilterOption<V>;

export interface CheckboxFilterDialogData<V = string> {
  readonly fieldLabel: string;
  readonly options: readonly CheckboxFilterDialogOption<V>[];
  /** `undefined` means the field is not filtered; `[]` a filter that matches nothing. */
  readonly selectedValues: readonly V[] | undefined;
}

/** What this dialog closes with. `undefined` (no object at all, or `''`) means the visitor
 * cancelled; `{ selected: undefined }` means no filter on this field — lifted, applied with nothing
 * ticked, or with every value ticked — which the caller must treat as an *absent* filter, never as
 * the full list of values; `{ selected: [] }` a selection the visitor emptied, matching nothing. */
export interface CheckboxFilterDialogResult<V = string> {
  readonly selected: V[] | undefined;
}

/**
 * The multi-select filter of one field (issue #113): a title naming the field, the searchable list
 * (`app-checkbox-filter-list` — its summary line, «انتخاب‌های فعلی» chips, group checkbox and Enter
 * rules), and «حذف محدودیت» / «انصراف» / «اعمال». One dialog for every multi-select filter: the
 * daily-BOM report (`/boms`), the dashboard's approval filters, the standard-BOM report and the
 * audit log, so they all read and behave alike. Generic over the value type (the standard-BOM
 * report's «فعال» filters booleans).
 *
 * A `MatDialog` rather than a `mat-menu`: the panel holds checkboxes, chips and a search box, none of
 * which are `mat-menu-item`s, and a `role="menu"` container requires menuitem-shaped children.
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
    <app-dialog-head [heading]="'فیلتر ' + data.fieldLabel" />

    <mat-dialog-content>
      <app-checkbox-filter-list
        [options]="data.options"
        [(selected)]="checked"
        (submitted)="onApply()"
      />
    </mat-dialog-content>

    <!-- «حذف محدودیت» lifts the filter outright; «انصراف» and the filled «اعمال» are the usual pair. -->
    <mat-dialog-actions class="dialog-footer dialog-footer--split">
      <button matButton type="button" (click)="onLift()">
        <mat-icon appIcon="clear" />حذف محدودیت
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
export class CheckboxFilterDialog<V = string> {
  private readonly dialogRef = inject(
    MatDialogRef<CheckboxFilterDialog<V>, CheckboxFilterDialogResult<V>>,
  );
  protected readonly data = inject<CheckboxFilterDialogData<V>>(MAT_DIALOG_DATA);

  private readonly allValues = this.data.options.map((option) => option.value);

  protected readonly checked = signal<CheckboxFilterSelection<V>>(
    this.data.selectedValues === undefined ? undefined : new Set(this.data.selectedValues),
  );

  protected onLift(): void {
    this.dialogRef.close({ selected: undefined });
  }

  /** Nothing ticked, or everything ticked, is no filter; an emptied selection matches nothing. */
  protected onApply(): void {
    const checked = this.checked();
    const selected =
      checked === undefined || checked.size === this.allValues.length
        ? undefined
        : this.allValues.filter((value) => checked.has(value));

    this.dialogRef.close({ selected });
  }
}
