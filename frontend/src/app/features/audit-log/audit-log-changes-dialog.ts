import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { rxResource } from '@angular/core/rxjs-interop';
import { MatButton } from '@angular/material/button';
import {
  MAT_DIALOG_DATA,
  MatDialogActions,
  MatDialogClose,
  MatDialogContent,
  MatDialogRef,
} from '@angular/material/dialog';
import { firstValueFrom } from 'rxjs';
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
import {
  AppAuditAction,
  AppRecordType,
  AuditLogGateway,
} from '../../core/audit-log/audit-log-gateway';
import { MaterialImportGateway } from '../../core/materials/material-import-gateway';
import { DialogHead } from '../../ui/dialog-head/dialog-head';
import { EmptyState } from '../../ui/empty-state/empty-state';
import { ErrorBanner } from '../../ui/error-banner/error-banner';
import { fieldLabel, fieldValue } from './field-labels';
import { materialImportLine } from './material-import-lines';
import { mapRevertError } from './server-errors';

const CHANGE_COLUMNS = ['field', 'previousValue', 'newValue'];

/** What the actor did, as the subtitle names it. */
const ACTED_LABELS: Readonly<Record<AppAuditAction, string>> = {
  Registered: 'ثبت‌شده',
  Edited: 'ویرایش‌شده',
  Deleted: 'حذف‌شده',
  Approved: 'تاییدشده',
  Rejected: 'عدم تایید شده',
  ReturnedToPending: 'بازگشته به در انتظار تایید',
  ApprovalRevoked: 'تایید لغوشده',
  Imported: 'بارگذاری‌شده',
  Reverted: 'برگردانده‌شده',
  Retired: 'کنار گذاشته‌شده',
};

export interface AuditLogChangesDialogData {
  readonly id: string;
  readonly actorName: string;
  readonly recordType: AppRecordType;
  /** For a `MaterialImport` entry, the import's id — what «برگرداندن» reverts. */
  readonly recordId: string;
  readonly recordTypeLabel: string;
  readonly action: AppAuditAction;
  readonly occurredAt: string;
  /** Whether the viewer's role may revert a bulk import (`canRevertMaterialImports`). */
  readonly canRevert: boolean;
}

interface SubjectView {
  readonly label: string;
  readonly value: string;
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
 * An entry whose changes don't name the record (a daily BOM's review event) carries a
 * subject, shown above the table as a one-term description list («شماره ردیابی» TRK-3005).
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
      } @else {
        @if (subject(); as named) {
          <dl class="subject">
            <dt>{{ named.label }}</dt>
            <dd class="subject__value">{{ named.value }}</dd>
          </dl>
        }

        @if (rows().length === 0) {
          <app-empty-state message="بدون تغییر فیلد." />
        } @else if (isImport) {
          <ul class="import-lines" aria-label="تغییرات بارگذاری گروهی">
            @for (line of importLines(); track $index) {
              <li>{{ line }}</li>
            }
          </ul>
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
      }
      @if (revertError(); as message) {
        <app-error-banner [message]="message" />
      }
    </mat-dialog-content>

    <mat-dialog-actions class="dialog-footer">
      <button matButton type="button" mat-dialog-close>بستن</button>
      @if (revertible) {
        <button matButton="filled" type="button" [disabled]="reverting()" (click)="revert()">
          برگرداندن
        </button>
      }
    </mat-dialog-actions>
  `,
  styleUrl: './audit-log-changes-dialog.scss',
})
export class AuditLogChangesDialog {
  protected readonly data = inject<AuditLogChangesDialogData>(MAT_DIALOG_DATA);
  private readonly gateway = inject(AuditLogGateway);
  private readonly importGateway = inject(MaterialImportGateway);
  private readonly dialogRef = inject(MatDialogRef<AuditLogChangesDialog, boolean>);
  protected readonly changeColumns = CHANGE_COLUMNS;
  protected readonly actedLabel = ACTED_LABELS[this.data.action];

  protected readonly formattedOccurredAt = this.formatOccurredAt(this.data.occurredAt);

  protected readonly changesResource = rxResource({
    params: () => ({ id: this.data.id }),
    stream: ({ params }) => this.gateway.changes(params.id),
  });

  /** Which record the entry concerns (a daily BOM's tracking number), or `null` when it names none. */
  protected readonly subject = computed((): SubjectView | null => {
    const subject = this.changesResource.hasValue() ? this.changesResource.value().subject : null;
    return subject === null ? null : { label: fieldLabel(subject.field), value: subject.value };
  });

  /** A bulk import's entries read as sentences, one per material, instead of a field table. */
  protected readonly isImport = this.data.recordType === 'MaterialImport';

  /** «برگرداندن» is on the import itself (never its reversion), for a role that may revert. */
  protected readonly revertible =
    this.isImport && this.data.action === 'Imported' && this.data.canRevert;

  protected readonly reverting = signal(false);
  protected readonly revertError = signal('');

  protected readonly importLines = computed(() =>
    this.changesResource.hasValue()
      ? this.changesResource.value().changes.map(materialImportLine)
      : [],
  );

  /**
   * Reverts at once — the button is the decision; there is no second confirmation. Success closes
   * the dialog with `true`, so the page re-reads the log that now holds the `Reverted` entry; a
   * refusal stays open and says why.
   */
  protected async revert(): Promise<void> {
    this.reverting.set(true);
    this.revertError.set('');
    try {
      await firstValueFrom(this.importGateway.revert(this.data.recordId));
      this.dialogRef.close(true);
    } catch (error) {
      this.revertError.set(mapRevertError(error));
    } finally {
      this.reverting.set(false);
    }
  }

  protected readonly rows = (): ChangeRow[] =>
    this.changesResource.hasValue()
      ? this.changesResource.value().changes.map((change) => ({
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
