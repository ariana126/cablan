import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { MatButton } from '@angular/material/button';
import { MatCheckbox, MatCheckboxChange } from '@angular/material/checkbox';
import {
  MAT_DIALOG_DATA,
  MatDialogActions,
  MatDialogClose,
  MatDialogContent,
  MatDialogRef,
  MatDialogTitle,
} from '@angular/material/dialog';
import { MatDivider } from '@angular/material/divider';

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
 * blocking-decision pattern every sibling feature's own dialogs already use.
 */
@Component({
  selector: 'app-bom-report-filter-dialog',
  imports: [
    MatButton,
    MatCheckbox,
    MatDialogActions,
    MatDialogClose,
    MatDialogContent,
    MatDialogTitle,
    MatDivider,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <h2 mat-dialog-title>فیلتر {{ data.fieldLabel }}</h2>

    <mat-dialog-content class="stack--tight">
      <mat-checkbox
        [checked]="allSelected()"
        [indeterminate]="partiallySelected()"
        (change)="onToggleAll($event)"
      >
        انتخاب همه
      </mat-checkbox>

      <mat-divider />

      @for (value of data.allValues; track value) {
        <mat-checkbox [checked]="isChecked(value)" (change)="onToggleValue(value, $event)">
          {{ value }}
        </mat-checkbox>
      }
    </mat-dialog-content>

    <mat-dialog-actions align="end">
      <button matButton type="button" mat-dialog-close>انصراف</button>
      <button matButton="filled" type="button" (click)="onApply()">اعمال فیلتر</button>
    </mat-dialog-actions>
  `,
  styleUrl: './bom-report-filter-dialog.scss',
})
export class BomReportFilterDialog {
  private readonly dialogRef = inject(
    MatDialogRef<BomReportFilterDialog, BomReportFilterDialogResult>,
  );
  protected readonly data = inject<BomReportFilterDialogData>(MAT_DIALOG_DATA);

  private readonly checked = signal<ReadonlySet<string>>(
    new Set(this.data.selectedValues ?? this.data.allValues),
  );

  protected readonly allSelected = () => this.checked().size === this.data.allValues.length;
  protected readonly partiallySelected = () =>
    this.checked().size > 0 && this.checked().size < this.data.allValues.length;

  protected isChecked(value: string): boolean {
    return this.checked().has(value);
  }

  protected onToggleAll(event: MatCheckboxChange): void {
    this.checked.set(event.checked ? new Set(this.data.allValues) : new Set());
  }

  protected onToggleValue(value: string, event: MatCheckboxChange): void {
    this.checked.update((current) => {
      const next = new Set(current);
      if (event.checked) {
        next.add(value);
      } else {
        next.delete(value);
      }
      return next;
    });
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
