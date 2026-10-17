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

export interface BomReportFilterDialogData {
  readonly fieldLabel: string;
  readonly allValues: readonly string[];
  /** `undefined` means every value counts as selected — no filter applied to this field yet. */
  readonly selectedValues: readonly string[] | undefined;
}

/** What this dialog closes with. `undefined` (no object at all) means the user cancelled;
 * `{ selected: undefined }` means "every value ended up checked", which the caller must send to the
 * backend as an *absent* filter key, never as the full list of values. */
export interface BomReportFilterDialogResult {
  readonly selected: string[] | undefined;
}

/**
 * The Excel-style per-column filter panel `reporting-bom.feature`'s own "مشابه فیلتر اکسل" rule asks
 * for — one instance reused for every checkbox-based field (برند, نام جز, کد MI, نام محصول,
 * کنترلگر). "تاریخ و زمان ثبت" is deliberately not one of them: `GET /boms/report/filter-options`
 * returns no distinct values for it, and the dispatch this was built against gives it its own
 * range control instead (`bom-reports-page.ts`'s date-range section) — see this feature area's own
 * README-style comment there for the full reasoning.
 *
 * A `MatDialog` rather than a `mat-menu`: the panel holds a "select all" checkbox plus one checkbox
 * per value, none of which are `mat-menu-item`s, and a `role="menu"` container requires menuitem-
 * shaped children to stay ARIA-valid. A dialog has no such restriction and reuses the same
 * blocking-decision pattern every sibling feature's own dialogs already use. The searchable value
 * list itself is the shared `app-checkbox-filter-list`.
 */
@Component({
  selector: 'app-bom-report-filter-dialog',
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
      <app-checkbox-filter-list [options]="options" [(selected)]="checked" />
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
  styleUrl: './bom-report-filter-dialog.scss',
})
export class BomReportFilterDialog {
  private readonly dialogRef = inject(
    MatDialogRef<BomReportFilterDialog, BomReportFilterDialogResult>,
  );
  protected readonly data = inject<BomReportFilterDialogData>(MAT_DIALOG_DATA);

  protected readonly options = this.data.allValues.map((value) => ({ value, label: value }));

  protected readonly checked = signal<ReadonlySet<string>>(
    new Set(this.data.selectedValues ?? this.data.allValues),
  );

  /** «۱ از ۲ انتخاب شده», or that nothing is chosen. */
  protected readonly summary = computed(() => {
    const chosen = this.checked().size;
    return chosen === 0
      ? 'هیچ مقداری انتخاب نشده'
      : `${formatPersianNumber(chosen)} از ${formatPersianNumber(this.data.allValues.length)} انتخاب شده`;
  });

  /** Removes the filter: every value counts as selected again, which the caller sends as no filter. */
  protected onClear(): void {
    this.dialogRef.close({ selected: undefined });
  }

  protected onApply(): void {
    const checked = this.checked();
    const selected =
      checked.size === this.data.allValues.length
        ? undefined
        : this.data.allValues.filter((value) => checked.has(value));

    this.dialogRef.close({ selected });
  }
}
