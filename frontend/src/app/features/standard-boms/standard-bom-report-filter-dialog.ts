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

      @for (option of data.options; track option.value) {
        <mat-checkbox
          [checked]="isChecked(option.value)"
          (change)="onToggleValue(option.value, $event)"
        >
          {{ option.label }}
        </mat-checkbox>
      }
    </mat-dialog-content>

    <mat-dialog-actions align="end">
      <button matButton type="button" mat-dialog-close>انصراف</button>
      <button matButton="filled" type="button" (click)="onApply()">اعمال فیلتر</button>
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

  private readonly checked = signal<ReadonlySet<V>>(
    new Set(this.data.selectedValues ?? this.data.options.map((option) => option.value)),
  );

  protected readonly allSelected = () => this.checked().size === this.data.options.length;
  protected readonly partiallySelected = () =>
    this.checked().size > 0 && this.checked().size < this.data.options.length;

  protected isChecked(value: V): boolean {
    return this.checked().has(value);
  }

  protected onToggleAll(event: MatCheckboxChange): void {
    this.checked.set(
      event.checked ? new Set(this.data.options.map((option) => option.value)) : new Set(),
    );
  }

  protected onToggleValue(value: V, event: MatCheckboxChange): void {
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
      checked.size === this.data.options.length
        ? undefined
        : this.data.options.map((option) => option.value).filter((value) => checked.has(value));

    this.dialogRef.close({ selected });
  }
}
