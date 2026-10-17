import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { MatButton } from '@angular/material/button';
import {
  MAT_DIALOG_DATA,
  MatDialogActions,
  MatDialogClose,
  MatDialogContent,
  MatDialogRef,
} from '@angular/material/dialog';

import { formatPersianNumber } from '../../core/i18n/persian-numerals';
import { CheckboxFilterList } from '../../ui/checkbox-filter-list/checkbox-filter-list';
import { DialogHead } from '../../ui/dialog-head/dialog-head';

/** A single filterable value — string for textual fields, boolean for "فعال". */
export type StandardBomFilterValue = string | boolean;

/** How a single value should be rendered in the dialog. */
export interface StandardBomFilterOption<V extends StandardBomFilterValue> {
  readonly value: V;
  readonly label: string;
}

export interface StandardBomReportFilterDialogData<V extends StandardBomFilterValue> {
  readonly fieldLabel: string;
  readonly options: readonly StandardBomFilterOption<V>[];
  /** `undefined` means every value counts as selected — no filter applied to this field yet. */
  readonly selectedValues: readonly V[] | undefined;
}

/** What this dialog closes with. `undefined` (no object at all) means the user cancelled;
 * `{ selected: undefined }` means "every value ended up checked", which the caller must send to the
 * backend as an *absent* filter key, never as the full list of values. */
export interface StandardBomReportFilterDialogResult<V extends StandardBomFilterValue> {
  readonly selected: readonly V[] | undefined;
}

/**
 * The Excel-style per-column filter panel — one instance reused for every checkbox-based field
 * (برند, فعال, نام محصول, نام جز). The "فعا ل" panel passes `boolean` values rendered as
 * "بله"/"خیر", the others pass plain strings; the dialog is generic over `V` so the same component
 * handles both without a branch.
 *
 * A `MatDialog` rather than a `mat-menu`: the panel holds a "select all" checkbox plus one
 * checkbox per value, none of which are `mat-menu-item`s, and a `role="menu"` container requires
 * menuitem-shaped children to stay ARIA-valid.
 */
@Component({
  selector: 'app-standard-bom-report-filter-dialog',
  imports: [
    CheckboxFilterList,
    DialogHead,
    MatButton,
    MatDialogActions,
    MatDialogClose,
    MatDialogContent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <app-dialog-head [heading]="'فیلتر ' + data.fieldLabel" [subtitle]="summary()" />

    <mat-dialog-content>
      <app-checkbox-filter-list [options]="data.options" [(selected)]="checked" />
    </mat-dialog-content>

    <!-- «پاک کردن» lifts the filter outright; «انصراف» and the filled «اعمال» are the usual pair. -->
    <mat-dialog-actions class="dialog-footer dialog-footer--split">
      <button matButton type="button" (click)="onClear()">پاک کردن</button>
      <span class="dialog-footer__group">
        <button matButton type="button" mat-dialog-close>انصراف</button>
        <button matButton="filled" type="button" (click)="onApply()">اعمال</button>
      </span>
    </mat-dialog-actions>
  `,
  styleUrl: './standard-bom-report-filter-dialog.scss',
})
export class StandardBomReportFilterDialog<
  V extends StandardBomFilterValue = StandardBomFilterValue,
> {
  private readonly dialogRef = inject(
    MatDialogRef<StandardBomReportFilterDialog<V>, StandardBomReportFilterDialogResult<V>>,
  );
  protected readonly data = inject<StandardBomReportFilterDialogData<V>>(MAT_DIALOG_DATA);

  protected readonly checked = signal<ReadonlySet<V>>(
    new Set(this.data.selectedValues ?? this.data.options.map((option) => option.value)),
  );

  /** «۱ از ۲ انتخاب شده», or that nothing is chosen. */
  protected readonly summary = computed(() => {
    const chosen = this.checked().size;
    return chosen === 0
      ? 'هیچ مقداری انتخاب نشده'
      : `${formatPersianNumber(chosen)} از ${formatPersianNumber(this.data.options.length)} انتخاب شده`;
  });

  /** Removes the filter: every value counts as selected again, which the caller sends as no filter. */
  protected onClear(): void {
    this.dialogRef.close({ selected: undefined });
  }

  protected onApply(): void {
    const checked = this.checked();
    const selected =
      checked.size === this.data.options.length
        ? undefined
        : this.data.options.map((option) => option.value).filter((value) => checked.has(value));

    this.dialogRef.close({ selected });
  }
}
