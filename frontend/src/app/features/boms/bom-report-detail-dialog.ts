import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { rxResource } from '@angular/core/rxjs-interop';
import { MatButton } from '@angular/material/button';
import {
  MAT_DIALOG_DATA,
  MatDialogActions,
  MatDialogClose,
  MatDialogContent,
  MatDialogRef,
  MatDialogTitle,
} from '@angular/material/dialog';
import { MatProgressBar } from '@angular/material/progress-bar';
import {
  MatCell,
  MatCellDef,
  MatColumnDef,
  MatHeaderCell,
  MatHeaderCellDef,
  MatHeaderRow,
  MatHeaderRowDef,
  MatRow,
  MatRowDef,
  MatTable,
} from '@angular/material/table';

import { AppBomDetail, BomReportGateway } from '../../core/boms/bom-report-gateway';
import { PersianNumberPipe } from '../../ui/persian-number/persian-number-pipe';

const COMPOSITION_COLUMNS = ['componentName', 'materialName', 'weight'];

export interface BomReportDetailDialogData {
  readonly id: string;
  readonly orderNumber: string;
  /** Whether to offer the two write actions at all — `/boms` passes its own `canManage()`, so the
   * card and the list row hide them together rather than the card offering something the row does
   * not. A گزارشگیر reads this card and finds only "بستن". */
  readonly canManage: boolean;
}

/**
 * What the card hands back when the visitor picks one of its two write actions. The card itself
 * stays presentational — it opens no dialog and injects no write gateway; `/boms` reacts to this
 * result and runs the very same code path its own row buttons do.
 *
 * The `edit` variant carries the detail it has *already fetched*, so the page can hand it straight
 * to the form dialog instead of re-issuing the `GET /boms/:id` the row path has to make. `delete`
 * carries nothing: the page already knows the row's id and order number, which is all the
 * confirmation needs.
 */
export type BomReportDetailDialogResult =
  { readonly action: 'edit'; readonly detail: AppBomDetail } | { readonly action: 'delete' };

interface ComponentMaterialRow {
  readonly componentName: string;
  readonly materialName: string;
  readonly weight: number;
}

function toRows(detail: AppBomDetail): ComponentMaterialRow[] {
  return detail.components.flatMap((component) =>
    component.materials.map((material) => ({
      componentName: component.name,
      materialName: material.name,
      weight: material.weight,
    })),
  );
}

/**
 * A single daily BOM's full composition — "کاربر با مشاهده جزئیات یک آنالیز
 * روزانه، متراژ استاندارد، اجزا، مواد اولیه، توضیحات و جمع وزن مواد اولیه آن را می بیند"
 * (`reporting-bom.feature`). `totalWeight` is rendered exactly as the API returns it — it is
 * computed server-side, and this dialog never recomputes it from the rendered rows.
 *
 * **The card carries the same two write actions the list row does** (when `canManage`), so a visitor who opened it to
 * check a composition can act on what they just read without closing it and hunting for the row
 * again. Both close the card and hand the decision back to `/boms` (see
 * `BomReportDetailDialogResult`) rather than stacking a second modal on top of this one.
 *
 * Their accessible names are scoped to the daily BOM (`ویرایش آنالیز روزانه 1001`) rather than bare
 * verbs, because the list's own row buttons (`ویرایش 1001`) and the delete confirmation's button
 * (`حذف`) are in the DOM at the same time; all three have to stay tellable apart by name alone.
 */
@Component({
  selector: 'app-bom-report-detail-dialog',
  imports: [
    PersianNumberPipe,
    MatButton,
    MatCell,
    MatCellDef,
    MatColumnDef,
    MatDialogActions,
    MatDialogClose,
    MatDialogContent,
    MatDialogTitle,
    MatHeaderCell,
    MatHeaderCellDef,
    MatHeaderRow,
    MatHeaderRowDef,
    MatProgressBar,
    MatRow,
    MatRowDef,
    MatTable,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <h2 mat-dialog-title>جزئیات آنالیز روزانه {{ data.orderNumber }}</h2>

    <mat-dialog-content class="stack">
      @if (detailResource.isLoading()) {
        <mat-progress-bar mode="indeterminate" aria-label="در حال بارگذاری جزئیات آنالیز روزانه" />
      } @else if (detailResource.error()) {
        <div class="stack--tight">
          <p role="alert" class="form-error">جزئیات آنالیز روزانه بارگذاری نشد.</p>
          <button matButton type="button" (click)="detailResource.reload()">تلاش دوباره</button>
        </div>
      } @else if (detailResource.value(); as detail) {
        <dl class="detail-fields">
          <dt>متراژ استاندارد</dt>
          <dd>{{ detail.standardLength | persianNumber }}</dd>

          <dt>توضیحات</dt>
          <dd>{{ detail.description || '—' }}</dd>

          <dt>جمع وزن مواد اولیه</dt>
          <dd>{{ detail.totalWeight | persianNumber }}</dd>
        </dl>

        @if (rows().length === 0) {
          <p>این آنالیز روزانه هیچ جز یا ماده اولیه‌ای ندارد.</p>
        } @else {
          <table mat-table [dataSource]="rows()" aria-label="اجزا و مواد اولیه">
            <ng-container matColumnDef="componentName">
              <th mat-header-cell *matHeaderCellDef>نام جز</th>
              <td mat-cell *matCellDef="let row">{{ row.componentName }}</td>
            </ng-container>

            <ng-container matColumnDef="materialName">
              <th mat-header-cell *matHeaderCellDef>نام مواد اولیه</th>
              <td mat-cell *matCellDef="let row">{{ row.materialName }}</td>
            </ng-container>

            <ng-container matColumnDef="weight">
              <th mat-header-cell *matHeaderCellDef>وزن مواد اولیه</th>
              <td mat-cell *matCellDef="let row">{{ row.weight | persianNumber }}</td>
            </ng-container>

            <tr mat-header-row *matHeaderRowDef="compositionColumns"></tr>
            <tr mat-row *matRowDef="let row; columns: compositionColumns"></tr>
          </table>
        }
      }
    </mat-dialog-content>

    <mat-dialog-actions align="end">
      @if (data.canManage && detailResource.hasValue()) {
        <button
          matButton
          type="button"
          [attr.aria-label]="'ویرایش آنالیز روزانه ' + data.orderNumber"
          (click)="onEdit()"
        >
          ویرایش
        </button>
        <button
          matButton
          type="button"
          [attr.aria-label]="'حذف آنالیز روزانه ' + data.orderNumber"
          (click)="onDelete()"
        >
          حذف
        </button>
      }
      <button matButton type="button" mat-dialog-close>بستن</button>
    </mat-dialog-actions>
  `,
  styleUrl: './bom-report-detail-dialog.scss',
})
export class BomReportDetailDialog {
  protected readonly data = inject<BomReportDetailDialogData>(MAT_DIALOG_DATA);
  private readonly dialogRef =
    inject<MatDialogRef<BomReportDetailDialog, BomReportDetailDialogResult>>(MatDialogRef);
  private readonly gateway = inject(BomReportGateway);
  protected readonly compositionColumns = COMPOSITION_COLUMNS;

  protected readonly detailResource = rxResource({
    params: () => ({ id: this.data.id }),
    stream: ({ params }) => this.gateway.get(params.id),
  });

  protected readonly rows = () =>
    this.detailResource.hasValue() ? toRows(this.detailResource.value()) : [];

  /** Reads the loaded detail rather than taking it as a template argument: `value()` throws while
   * the resource is in an error state, so the template reaches it through `hasValue()` and never
   * binds it. The guard below is what that costs — the button does not render without a value. */
  protected onEdit(): void {
    const detail = this.detailResource.value();
    if (detail === undefined) {
      return;
    }
    this.dialogRef.close({ action: 'edit', detail });
  }

  protected onDelete(): void {
    this.dialogRef.close({ action: 'delete' });
  }
}
