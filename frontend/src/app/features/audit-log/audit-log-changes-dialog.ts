import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { rxResource } from '@angular/core/rxjs-interop';
import { MatButton } from '@angular/material/button';
import {
  MAT_DIALOG_DATA,
  MatDialogActions,
  MatDialogClose,
  MatDialogContent,
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
import { AppAuditAction, AuditLogGateway } from '../../core/audit-log/audit-log-gateway';
import { DialogHead } from '../../ui/dialog-head/dialog-head';
import { EmptyState } from '../../ui/empty-state/empty-state';
import { ErrorBanner } from '../../ui/error-banner/error-banner';
import { fieldLabel, fieldValue } from './field-labels';

const CHANGE_COLUMNS = ['field', 'previousValue', 'newValue'];

/** What the actor did, as the subtitle names it. */
const ACTED_LABELS: Readonly<Record<AppAuditAction, string>> = {
  Registered: 'ثبت‌شده',
  Edited: 'ویرایش‌شده',
  Deleted: 'حذف‌شده',
  Approved: 'تاییدشده',
  ApprovalRevoked: 'تایید لغوشده',
};

export interface AuditLogChangesDialogData {
  readonly id: string;
  readonly actorName: string;
  readonly recordTypeLabel: string;
  readonly action: AppAuditAction;
  readonly occurredAt: string;
}

interface ChangeRow {
  readonly fieldLabel: string;
  readonly previousValue: string;
  readonly newValue: string;
}

/**
 * Read-only drill-in for a single audit-log entry's field-level changes — the "System Admin views
 * the field-level changes of a record" detail view. An `Edited` entry carries before → after for each
 * changed field; a `Registered` entry carries what was registered (empty → value) and a `Deleted` one
 * what was removed (value → empty), each with one `component` line per component of a composition.
 * The empty side renders as the usual `—` placeholder rather than a blank cell, and a value with a
 * Persian label of its own (a role, the active flag) renders as that label — see `fieldValue`.
 */
@Component({
  selector: 'app-audit-log-changes-dialog',
  imports: [
    DialogHead,
    EmptyState,
    ErrorBanner,
    MatButton,
    MatCell,
    MatCellDef,
    MatColumnDef,
    MatDialogActions,
    MatDialogClose,
    MatDialogContent,
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
    <app-dialog-head
      [heading]="'جزئیات تغییرات ' + data.recordTypeLabel"
      [subtitle]="actedLabel + ' توسط ' + data.actorName + ' در ' + formattedOccurredAt"
    />

    <mat-dialog-content class="stack">
      @if (changesResource.isLoading()) {
        <mat-progress-bar mode="indeterminate" aria-label="در حال بارگذاری جزئیات تغییرات" />
      } @else if (changesResource.error()) {
        <app-error-banner
          message="جزئیات تغییرات بارگذاری نشد."
          retryLabel="تلاش دوباره"
          (retry)="changesResource.reload()"
        />
      } @else if (rows().length === 0) {
        <app-empty-state message="بدون تغییر فیلد." />
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

    <mat-dialog-actions class="dialog-footer">
      <button matButton type="button" mat-dialog-close>بستن</button>
    </mat-dialog-actions>
  `,
  styleUrl: './audit-log-changes-dialog.scss',
})
export class AuditLogChangesDialog {
  protected readonly data = inject<AuditLogChangesDialogData>(MAT_DIALOG_DATA);
  private readonly gateway = inject(AuditLogGateway);
  protected readonly changeColumns = CHANGE_COLUMNS;
  protected readonly actedLabel = ACTED_LABELS[this.data.action];

  protected readonly formattedOccurredAt = this.formatOccurredAt(this.data.occurredAt);

  protected readonly changesResource = rxResource({
    params: () => ({ id: this.data.id }),
    stream: ({ params }) => this.gateway.changes(params.id),
  });

  protected readonly rows = (): ChangeRow[] =>
    this.changesResource.hasValue()
      ? this.changesResource.value().map((change) => ({
          fieldLabel: fieldLabel(change.field),
          previousValue: fieldValue(change.field, change.previousValue),
          newValue: fieldValue(change.field, change.newValue),
        }))
      : [];

  private formatOccurredAt(iso: string): string {
    const parsed = new Date(iso);
    return Number.isNaN(parsed.getTime()) ? '—' : formatJalaliDateTime(parsed);
  }
}
