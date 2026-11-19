import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { MatButton } from '@angular/material/button';
import {
  MAT_DIALOG_DATA,
  MatDialogActions,
  MatDialogContent,
  MatDialogRef,
} from '@angular/material/dialog';
import { MatIcon } from '@angular/material/icon';
import { MatProgressBar } from '@angular/material/progress-bar';
import { firstValueFrom } from 'rxjs';

import {
  AppPmPlanImport,
  PmPlanImportGateway,
} from '../../core/maintenance/pm-plan-import-gateway';
import { DialogHead } from '../../ui/dialog-head/dialog-head';
import { ErrorBanner } from '../../ui/error-banner/error-banner';
import { Icon } from '../../ui/icon/icon';
import { mapPmPlanImportError } from './pm-plan-import-errors';
import { addableLine, addedLine } from './pm-plan-import-report';
import {
  PmPlanImportConflictsTable,
  PmPlanImportErrorsTable,
  PmPlanImportItemsTable,
} from './pm-plan-import-tables';

export interface PmPlanImportDialogData {
  /** The workbook the visitor chose — sent again, as it is, by «تایید». */
  readonly file: Blob;
  /** The server's check of it. */
  readonly report: AppPmPlanImport;
}

/**
 * «بارگذاری برنامه PM از اکسل» (issue #127): the system's check of the uploaded PM-plan workbook,
 * then — after «تایید» — what the import added. Each part of the report is a `<section>` named by
 * its `h3`, drawn only when it has rows: «خطاها», the rows confirming adds, «از قبل موجود» and
 * «اختلاف با برنامه موجود».
 *
 * «تایید» re-sends the same file; the server checks it afresh and adds every new row or none. It is
 * disabled while the file has errors (a `.dialog-notice` says why) or adds nothing. A refusal stays
 * in the dialog as its one `role="alert"`; a file found with errors this time also replaces the
 * errors table. Once the import is in, the result replaces the check and only «بستن» closes it
 * (closing `true`, so the board re-reads) — the head has no close button, so «بستن» names one thing.
 */
@Component({
  selector: 'app-pm-plan-import-dialog',
  imports: [
    DialogHead,
    ErrorBanner,
    Icon,
    MatButton,
    MatDialogActions,
    MatDialogContent,
    MatIcon,
    MatProgressBar,
    PmPlanImportConflictsTable,
    PmPlanImportErrorsTable,
    PmPlanImportItemsTable,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <app-dialog-head
      heading="بارگذاری برنامه PM از اکسل"
      [subtitle]="'شیت «' + report().sheetName + '»'"
      [showClose]="false"
    />

    <!-- Focusable: a long report scrolls, and axe wants a scrolling region reachable by keyboard. -->
    <mat-dialog-content class="stack stack--tight" tabindex="0">
      @if (submitting()) {
        <mat-progress-bar mode="indeterminate" aria-label="در حال ثبت برنامه‌ها" />
      }
      @if (error(); as message) {
        <app-error-banner [message]="message" />
      }

      <p class="import-headline" role="status">
        <mat-icon [appIcon]="imported() ? 'check-circle' : 'spreadsheet'" />
        <span>{{ imported() ? added() : addable() }}</span>
      </p>

      @if (hasErrors()) {
        <p class="dialog-notice">
          <mat-icon appIcon="info" />
          <span
            >تا وقتی فایل خطا دارد هیچ برنامه‌ای ثبت نمی‌شود؛ خطاها را در اکسل اصلاح و فایل را
            دوباره بارگذاری کنید.</span
          >
        </p>
        <section class="import-section" aria-labelledby="pm-import-errors">
          <h3 id="pm-import-errors" class="import-section__title">خطاها</h3>
          <app-pm-plan-import-errors-table [errors]="report().errors" />
        </section>
      }

      @if (report().toCreate.length > 0) {
        <section class="import-section" aria-labelledby="pm-import-to-create">
          <h3 id="pm-import-to-create" class="import-section__title">
            {{ imported() ? 'برنامه‌های ثبت شده' : 'برنامه‌های قابل ثبت' }}
          </h3>
          <app-pm-plan-import-items-table [items]="report().toCreate" />
        </section>
      }

      @if (report().alreadyExisting.length > 0) {
        <section class="import-section" aria-labelledby="pm-import-existing">
          <h3 id="pm-import-existing" class="import-section__title">از قبل موجود</h3>
          <p class="import-section__note">
            این برنامه‌ها با همین دوره و اولین موعد فعال هستند و دوباره ثبت نمی‌شوند.
          </p>
          <app-pm-plan-import-items-table [items]="report().alreadyExisting" />
        </section>
      }

      @if (report().conflicts.length > 0) {
        <section class="import-section" aria-labelledby="pm-import-conflicts">
          <h3 id="pm-import-conflicts" class="import-section__title">اختلاف با برنامه موجود</h3>
          <p class="import-section__note">
            برنامهٔ فعال موجود تغییر نمی‌کند؛ برای تغییر آن، پروندهٔ تجهیز را باز کنید.
          </p>
          <app-pm-plan-import-conflicts-table [conflicts]="report().conflicts" />
        </section>
      }
    </mat-dialog-content>

    <mat-dialog-actions class="dialog-footer">
      @if (imported()) {
        <button matButton="filled" type="button" (click)="close()">
          <mat-icon appIcon="close" />بستن
        </button>
      } @else {
        <button matButton type="button" (click)="cancel()">
          <mat-icon appIcon="cancel" />انصراف
        </button>
        <button
          matButton="filled"
          type="button"
          [disabled]="!confirmable() || submitting()"
          (click)="confirm()"
        >
          <mat-icon appIcon="check" />تایید
        </button>
      }
    </mat-dialog-actions>
  `,
  styleUrl: './pm-plan-import-dialog.scss',
})
export class PmPlanImportDialog {
  private readonly dialogRef = inject(MatDialogRef<PmPlanImportDialog, boolean>);
  private readonly data = inject<PmPlanImportDialogData>(MAT_DIALOG_DATA);
  private readonly gateway = inject(PmPlanImportGateway);

  /** The check, or — once imported — the import's own report. */
  protected readonly report = signal<AppPmPlanImport>(this.data.report);
  protected readonly imported = signal(false);
  protected readonly submitting = signal(false);
  protected readonly error = signal('');

  protected readonly hasErrors = computed(() => this.report().errors.length > 0);
  protected readonly confirmable = computed(
    () => !this.hasErrors() && this.report().counts.toCreate > 0,
  );
  protected readonly addable = computed(() => addableLine(this.report().counts.toCreate));
  protected readonly added = computed(() => addedLine(this.report().toCreate.length));

  protected async confirm(): Promise<void> {
    this.submitting.set(true);
    this.error.set('');

    try {
      const result = await firstValueFrom(this.gateway.import(this.data.file));
      this.report.set(result);
      this.imported.set(true);
      // The plans changed: the result is acknowledged with «بستن», which tells the board to re-read.
      this.dialogRef.disableClose = true;
    } catch (importError) {
      const refusal = mapPmPlanImportError(importError);
      const errors = refusal.errors;
      if (errors !== undefined) {
        this.report.update((report) => ({
          ...report,
          errors,
          counts: { ...report.counts, errors: errors.length },
        }));
      }
      this.error.set(refusal.message);
    } finally {
      this.submitting.set(false);
    }
  }

  protected cancel(): void {
    this.dialogRef.close(false);
  }

  protected close(): void {
    this.dialogRef.close(true);
  }
}
