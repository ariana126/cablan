import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
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

import {
  AppStandardBomDetail,
  StandardBomReportGateway,
} from '../../core/standard-boms/standard-bom-report-gateway';

const COMPOSITION_COLUMNS = ['componentName', 'materialName', 'weight'];

export interface StandardBomReportDetailDialogData {
  readonly id: string;
  readonly miCode: string;
  /** Whether to offer the two write actions at all — `/standard-boms` passes its own `canManage()`,
   * so the card and the list row hide them together rather than the card offering something the row
   * does not. A گزارشگیر or a بازرس کنترل کیفیت reads this card and finds only "بستن". */
  readonly canManage: boolean;
}

/**
 * What the card hands back when the visitor picks one of its two write actions. The card stays
 * presentational — it opens no dialog and injects no write gateway; `/standard-boms` reacts to this
 * result and runs the very same code path its own row buttons do.
 *
 * Neither variant carries a payload: unlike the daily-BOM card, the standard-BOM detail read model
 * has no `productId`, so an edit cannot be served from it anyway — the page resolves the full
 * `AppStandardBom` from the list it already holds, exactly as its row button does.
 */
export type StandardBomReportDetailDialogResult =
  { readonly action: 'edit' } | { readonly action: 'delete' };

interface ComponentMaterialRow {
  readonly componentName: string;
  readonly materialName: string;
  readonly weight: number;
}

function toRows(detail: AppStandardBomDetail): ComponentMaterialRow[] {
  return detail.components.flatMap((component) =>
    component.materials.map((material) => ({
      componentName: component.name,
      materialName: material.name,
      weight: material.weight,
    })),
  );
}

/**
 * A single standard BOM's full composition. Shows متراژ استاندارد, توضیحات,
 * اجزا و مواد اولیه (table) and جمع وزن مواد اولیه — none of which appear in the list view.
 * `totalWeight` is rendered exactly as the API returns it — it is computed server-side, and this
 * dialog never recomputes it from the rendered rows.
 *
 * **The card carries the same two write actions the list row does** (when `canManage`), so a visitor
 * who opened it to check a composition can act on what they just read without closing it and hunting
 * for the row again. Both close the card and hand the decision back to `/standard-boms` rather than
 * stacking a second modal on top of this one.
 *
 * Their accessible names are scoped to the standard BOM (`ویرایش آنالیز استاندارد 1001`) rather than
 * bare verbs, because the list's own row buttons (`ویرایش 1001`) and the delete confirmation's
 * button (`حذف`) are in the DOM at the same time; all three have to stay tellable apart by name
 * alone.
 */
@Component({
  selector: 'app-standard-bom-report-detail-dialog',
  imports: [
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
    <h2 mat-dialog-title>جزئیات آنالیز استاندارد {{ data.miCode }}</h2>

    <mat-dialog-content class="stack">
      @if (detailResource.isLoading()) {
        <mat-progress-bar
          mode="indeterminate"
          aria-label="در حال بارگذاری جزئیات آنالیز استاندارد"
        />
      } @else if (detailResource.error()) {
        <div class="stack--tight">
          <p role="alert" class="form-error">جزئیات آنالیز استاندارد بارگذاری نشد.</p>
          <button matButton type="button" (click)="detailResource.reload()">تلاش دوباره</button>
        </div>
      } @else if (detailResource.value(); as detail) {
        <dl class="detail-fields">
          <dt>متراژ استاندارد</dt>
          <dd>{{ detail.standardLength }}</dd>

          <dt>توضیحات</dt>
          <dd>{{ detail.description || '—' }}</dd>

          <dt>جمع وزن مواد اولیه</dt>
          <dd>{{ detail.totalWeight }}</dd>
        </dl>

        @if (rows().length === 0) {
          <p>این آنالیز استاندارد هیچ جز یا ماده اولیه‌ای ندارد.</p>
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
              <td mat-cell *matCellDef="let row">{{ row.weight }}</td>
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
          [attr.aria-label]="'ویرایش آنالیز استاندارد ' + data.miCode"
          (click)="onEdit()"
        >
          ویرایش
        </button>
        <button
          matButton
          type="button"
          [attr.aria-label]="'حذف آنالیز استاندارد ' + data.miCode"
          (click)="onDelete()"
        >
          حذف
        </button>
      }
      <button matButton type="button" mat-dialog-close>بستن</button>
    </mat-dialog-actions>
  `,
  styleUrl: './standard-bom-report-detail-dialog.scss',
})
export class StandardBomReportDetailDialog {
  protected readonly data = inject<StandardBomReportDetailDialogData>(MAT_DIALOG_DATA);
  private readonly dialogRef =
    inject<MatDialogRef<StandardBomReportDetailDialog, StandardBomReportDetailDialogResult>>(
      MatDialogRef,
    );
  private readonly gateway = inject(StandardBomReportGateway);
  protected readonly compositionColumns = COMPOSITION_COLUMNS;

  protected readonly detailResource = rxResource({
    params: () => ({ miCode: this.data.miCode }),
    stream: ({ params }) => this.gateway.getDetail(params.miCode),
  });

  protected readonly rows = computed<ComponentMaterialRow[]>(() =>
    this.detailResource.hasValue() ? toRows(this.detailResource.value()) : [],
  );

  protected onEdit(): void {
    this.dialogRef.close({ action: 'edit' });
  }

  protected onDelete(): void {
    this.dialogRef.close({ action: 'delete' });
  }
}
