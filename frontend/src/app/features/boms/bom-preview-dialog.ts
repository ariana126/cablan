import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { rxResource } from '@angular/core/rxjs-interop';
import { MatButton } from '@angular/material/button';
import {
  MAT_DIALOG_DATA,
  MatDialogActions,
  MatDialogContent,
  MatDialogRef,
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
import { MatIcon } from '@angular/material/icon';

import { AppBomWeightDifference, BomsGateway } from '../../core/boms/boms-gateway';
import { DialogHead } from '../../ui/dialog-head/dialog-head';
import { ErrorBanner } from '../../ui/error-banner/error-banner';
import { PersianNumberPipe } from '../../ui/persian-number/persian-number-pipe';
import { WeightDifference } from '../../ui/weight-difference/weight-difference';
import { Icon } from '../../ui/icon/icon';

const COLUMNS = ['componentName', 'materialName', 'actualWeight', 'difference'];

export interface BomPreviewDialogData {
  /** The daily BOM just registered. */
  readonly id: string;
}

/** «ویرایش» closes with `'edit'`; «تایید», the close button and Escape close with nothing. */
export type BomPreviewDialogResult = 'edit';

/**
 * What a QC operator sees right after registering a daily BOM (issue #50): every material line's
 * registered weight and how far it sits from the standard BOM, so a mistyped weight shows up before
 * anyone else reads it.
 *
 * The difference is the API's (`GET /boms/:id/weight-differences`, the absolute deviation) shown
 * exactly as the dashboard's `daily-bom-card` shows it: `app-weight-difference` with the direction
 * read off the two weights, and an empty cell for a line on its standard. The standard weight itself
 * is deliberately not shown — the preview is about the deviation, not a second copy of the standard.
 *
 * The dialog stays presentational: «ویرایش» hands the decision back to `/boms`, which opens the edit
 * form through the very path a row edit takes, so every edit rule and message applies unchanged.
 * Both actions stay offered while the differences fail to load — the BOM is registered either way.
 */
@Component({
  selector: 'app-bom-preview-dialog',
  imports: [
    DialogHead,
    ErrorBanner,
    Icon,
    MatButton,
    MatCell,
    MatCellDef,
    MatColumnDef,
    MatDialogActions,
    MatDialogContent,
    MatHeaderCell,
    MatHeaderCellDef,
    MatHeaderRow,
    MatHeaderRowDef,
    MatIcon,
    MatProgressBar,
    MatRow,
    MatRowDef,
    MatTable,
    PersianNumberPipe,
    WeightDifference,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <app-dialog-head
      heading="پیش‌نمایش آنالیز روزانه"
      subtitle="اختلاف وزن هر ماده اولیه با آنالیز استاندارد."
    />

    <mat-dialog-content class="stack">
      @if (linesResource.isLoading()) {
        <mat-progress-bar mode="indeterminate" aria-label="در حال بارگذاری اختلاف وزن مواد اولیه" />
      } @else if (linesResource.error()) {
        <app-error-banner
          message="اختلاف وزن مواد اولیه بارگذاری نشد."
          retryLabel="تلاش دوباره"
          (retry)="linesResource.reload()"
        />
      } @else if (linesResource.hasValue()) {
        <div class="lines">
          <table mat-table [dataSource]="linesResource.value()" aria-label="اختلاف وزن مواد اولیه">
            <ng-container matColumnDef="componentName">
              <th mat-header-cell *matHeaderCellDef>نام جز</th>
              <td mat-cell *matCellDef="let line">{{ line.componentName }}</td>
            </ng-container>

            <ng-container matColumnDef="materialName">
              <th mat-header-cell *matHeaderCellDef>نام مواد اولیه</th>
              <td mat-cell *matCellDef="let line">{{ line.materialName }}</td>
            </ng-container>

            <ng-container matColumnDef="actualWeight">
              <th mat-header-cell *matHeaderCellDef>
                <span class="cell-end">وزن مواد اولیه</span>
              </th>
              <td mat-cell *matCellDef="let line">
                <span class="cell-end">{{ line.actualWeight | persianNumber }}</span>
              </td>
            </ng-container>

            <ng-container matColumnDef="difference">
              <th mat-header-cell *matHeaderCellDef>
                <span class="cell-end">اختلاف وزن</span>
              </th>
              <!-- A line on its standard has nothing to flag, so its cell stays empty. -->
              <td mat-cell *matCellDef="let line">
                @if (line.difference !== 0) {
                  <span class="cell-end">
                    <app-weight-difference
                      [direction]="deviationOf(line)"
                      [value]="line.difference"
                    />
                  </span>
                }
              </td>
            </ng-container>

            <tr mat-header-row *matHeaderRowDef="columns"></tr>
            <tr mat-row *matRowDef="let line; columns: columns"></tr>
          </table>
        </div>
      }
    </mat-dialog-content>

    <mat-dialog-actions class="dialog-footer">
      <button matButton type="button" (click)="onEdit()"><mat-icon appIcon="edit" />ویرایش</button>
      <button matButton="filled" type="button" (click)="onConfirm()">
        <mat-icon appIcon="check" />تایید
      </button>
    </mat-dialog-actions>
  `,
  styleUrl: './bom-preview-dialog.scss',
})
export class BomPreviewDialog {
  protected readonly data = inject<BomPreviewDialogData>(MAT_DIALOG_DATA);
  private readonly dialogRef =
    inject<MatDialogRef<BomPreviewDialog, BomPreviewDialogResult>>(MatDialogRef);
  private readonly gateway = inject(BomsGateway);
  protected readonly columns = COLUMNS;

  protected readonly linesResource = rxResource({
    params: () => ({ id: this.data.id }),
    stream: ({ params }) => this.gateway.weightDifferences(params.id),
  });

  /** Only asked of a line with a non-zero difference; an exact match renders no pill at all. */
  protected deviationOf(line: AppBomWeightDifference): 'above' | 'below' {
    return line.actualWeight > line.standardWeight ? 'above' : 'below';
  }

  protected onConfirm(): void {
    this.dialogRef.close();
  }

  protected onEdit(): void {
    this.dialogRef.close('edit');
  }
}
