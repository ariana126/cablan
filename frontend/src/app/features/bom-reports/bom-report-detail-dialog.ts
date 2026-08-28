import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { rxResource } from '@angular/core/rxjs-interop';
import { MatButton } from '@angular/material/button';
import {
  MAT_DIALOG_DATA,
  MatDialogActions,
  MatDialogClose,
  MatDialogContent,
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

const COMPOSITION_COLUMNS = ['componentName', 'materialName', 'weight'];

export interface BomReportDetailDialogData {
  readonly id: string;
  readonly orderNumber: string;
}

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
 * Read-only view of a single daily BOM's full composition — "کاربر با مشاهده جزئیات یک آنالیز
 * روزانه، متراژ استاندارد، اجزا، مواد اولیه، توضیحات و جمع وزن مواد اولیه آن را می بیند"
 * (`reporting-bom.feature`). `totalWeight` is rendered exactly as the API returns it — it is
 * computed server-side, and this dialog never recomputes it from the rendered rows.
 */
@Component({
  selector: 'app-bom-report-detail-dialog',
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
          <dd>{{ detail.standardLength }}</dd>

          <dt>توضیحات</dt>
          <dd>{{ detail.description || '—' }}</dd>

          <dt>جمع وزن مواد اولیه</dt>
          <dd>{{ detail.totalWeight }}</dd>
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
              <td mat-cell *matCellDef="let row">{{ row.weight }}</td>
            </ng-container>

            <tr mat-header-row *matHeaderRowDef="compositionColumns"></tr>
            <tr mat-row *matRowDef="let row; columns: compositionColumns"></tr>
          </table>
        }
      }
    </mat-dialog-content>

    <mat-dialog-actions align="end">
      <button matButton type="button" mat-dialog-close>بستن</button>
    </mat-dialog-actions>
  `,
  styleUrl: './bom-report-detail-dialog.scss',
})
export class BomReportDetailDialog {
  protected readonly data = inject<BomReportDetailDialogData>(MAT_DIALOG_DATA);
  private readonly gateway = inject(BomReportGateway);
  protected readonly compositionColumns = COMPOSITION_COLUMNS;

  protected readonly detailResource = rxResource({
    params: () => ({ id: this.data.id }),
    stream: ({ params }) => this.gateway.get(params.id),
  });

  protected readonly rows = () =>
    this.detailResource.hasValue() ? toRows(this.detailResource.value()) : [];
}
