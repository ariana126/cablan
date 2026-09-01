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

import { formatJalaliDateTime } from '../../core/date/jalali-datetime';
import { AuditLogGateway } from '../../core/audit-log/audit-log-gateway';
import { fieldLabel } from './field-labels';

const CHANGE_COLUMNS = ['field', 'previousValue', 'newValue'];

export interface AuditLogChangesDialogData {
  readonly id: string;
  readonly actorName: string;
  readonly recordTypeLabel: string;
  readonly occurredAt: string;
}

interface ChangeRow {
  readonly fieldLabel: string;
  readonly previousValue: string;
  readonly newValue: string;
}

/**
 * Read-only drill-in for a single audit-log entry's field-level before/after changes — the "System
 * Admin views the field-level changes of an edited record" detail view. Only ever opened for an
 * `Edited` entry from `AuditLogPage`, since a `Registered`/`Deleted` entry carries no changes to show
 * (`AuditLogGateway.changes` still returns `[]` for either, and this dialog renders that gracefully
 * rather than assuming its caller never lets it happen).
 */
@Component({
  selector: 'app-audit-log-changes-dialog',
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
    <h2 mat-dialog-title>جزئیات تغییرات {{ data.recordTypeLabel }}</h2>

    <mat-dialog-content class="stack">
      <p class="subtitle">ویرایش‌شده توسط {{ data.actorName }} در {{ formattedOccurredAt }}</p>

      @if (changesResource.isLoading()) {
        <mat-progress-bar mode="indeterminate" aria-label="در حال بارگذاری جزئیات تغییرات" />
      } @else if (changesResource.error()) {
        <div class="stack--tight">
          <p role="alert" class="form-error">جزئیات تغییرات بارگذاری نشد.</p>
          <button matButton type="button" (click)="changesResource.reload()">تلاش دوباره</button>
        </div>
      } @else if (rows().length === 0) {
        <p>بدون تغییر فیلد.</p>
      } @else {
        <table mat-table [dataSource]="rows()" aria-label="تغییرات فیلدها">
          <ng-container matColumnDef="field">
            <th mat-header-cell *matHeaderCellDef>فیلد</th>
            <td mat-cell *matCellDef="let row">{{ row.fieldLabel }}</td>
          </ng-container>

          <ng-container matColumnDef="previousValue">
            <th mat-header-cell *matHeaderCellDef>مقدار قبلی</th>
            <td mat-cell *matCellDef="let row">{{ row.previousValue }}</td>
          </ng-container>

          <ng-container matColumnDef="newValue">
            <th mat-header-cell *matHeaderCellDef>مقدار جدید</th>
            <td mat-cell *matCellDef="let row">{{ row.newValue }}</td>
          </ng-container>

          <tr mat-header-row *matHeaderRowDef="changeColumns"></tr>
          <tr mat-row *matRowDef="let row; columns: changeColumns"></tr>
        </table>
      }
    </mat-dialog-content>

    <mat-dialog-actions align="end">
      <button matButton type="button" mat-dialog-close>بستن</button>
    </mat-dialog-actions>
  `,
  styleUrl: './audit-log-changes-dialog.scss',
})
export class AuditLogChangesDialog {
  protected readonly data = inject<AuditLogChangesDialogData>(MAT_DIALOG_DATA);
  private readonly gateway = inject(AuditLogGateway);
  protected readonly changeColumns = CHANGE_COLUMNS;

  protected readonly formattedOccurredAt = this.formatOccurredAt(this.data.occurredAt);

  protected readonly changesResource = rxResource({
    params: () => ({ id: this.data.id }),
    stream: ({ params }) => this.gateway.changes(params.id),
  });

  protected readonly rows = (): ChangeRow[] =>
    this.changesResource.hasValue()
      ? this.changesResource.value().map((change) => ({
          fieldLabel: fieldLabel(change.field),
          previousValue: change.previousValue,
          newValue: change.newValue,
        }))
      : [];

  private formatOccurredAt(iso: string): string {
    const parsed = new Date(iso);
    return Number.isNaN(parsed.getTime()) ? '—' : formatJalaliDateTime(parsed);
  }
}
