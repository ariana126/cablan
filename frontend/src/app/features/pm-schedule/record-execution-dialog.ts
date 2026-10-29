import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { form, FormField, submit } from '@angular/forms/signals';
import { MatButton } from '@angular/material/button';
import {
  MAT_DIALOG_DATA,
  MatDialogActions,
  MatDialogClose,
  MatDialogContent,
  MatDialogRef,
} from '@angular/material/dialog';
import { MatFormField, MatHint, MatLabel } from '@angular/material/form-field';
import { MatInput } from '@angular/material/input';
import { firstValueFrom } from 'rxjs';

import { formatJalaliCalendarDate } from '../../core/date/calendar-date';
import { PmPlansGateway } from '../../core/maintenance/pm-plans-gateway';
import { AppDailyPmTask } from '../../core/maintenance/pm-schedule-gateway';
import { DialogHead } from '../../ui/dialog-head/dialog-head';
import { ErrorBanner } from '../../ui/error-banner/error-banner';
import { mapRecordExecutionError } from './server-errors';

export interface RecordExecutionDialogData {
  readonly task: AppDailyPmTask;
}

interface RecordExecutionFormModel {
  readonly notes: string;
}

/**
 * «ثبت انجام» for one task of today's list: the job was done, now, by whoever is signed in — there
 * is no back-dating and no other outcome. Notes are optional. Which occurrence it lands on is the
 * API's rule; the dialog only names the one the list showed.
 */
@Component({
  selector: 'app-record-execution-dialog',
  imports: [
    DialogHead,
    ErrorBanner,
    FormField,
    MatButton,
    MatDialogActions,
    MatDialogClose,
    MatDialogContent,
    MatFormField,
    MatHint,
    MatInput,
    MatLabel,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <app-dialog-head [heading]="'ثبت انجام ' + data.task.activityName" [subtitle]="subtitle()" />

    <form novalidate (submit)="onSubmit(); $event.preventDefault()">
      <mat-dialog-content class="stack">
        @if (recordForm().errors().length) {
          <app-error-banner [message]="recordForm().errors()[0].message ?? ''" />
        }

        <mat-form-field appearance="outline">
          <mat-label>توضیحات</mat-label>
          <textarea matInput rows="3" [formField]="recordForm.notes"></textarea>
          <mat-hint>اختیاری</mat-hint>
        </mat-form-field>
      </mat-dialog-content>

      <mat-dialog-actions class="dialog-footer">
        <button matButton type="button" mat-dialog-close>انصراف</button>
        <button matButton="filled" type="submit" [disabled]="recordForm().submitting()">
          ثبت انجام
        </button>
      </mat-dialog-actions>
    </form>
  `,
  styleUrl: './record-execution-dialog.scss',
})
export class RecordExecutionDialog {
  private readonly dialogRef = inject(MatDialogRef<RecordExecutionDialog, boolean>);
  protected readonly data = inject<RecordExecutionDialogData>(MAT_DIALOG_DATA);
  private readonly gateway = inject(PmPlansGateway);

  protected readonly subtitle = computed(
    () =>
      `${this.data.task.equipmentName} · موعد ${formatJalaliCalendarDate(this.data.task.dueDate)}`,
  );

  private readonly model = signal<RecordExecutionFormModel>({ notes: '' });
  protected readonly recordForm = form(this.model);

  protected onSubmit(): Promise<boolean> {
    return submit(this.recordForm, async () => {
      try {
        const { equipmentId, planItemId } = this.data.task;
        await firstValueFrom(
          this.gateway.recordExecution(equipmentId, planItemId, this.model().notes),
        );
        this.dialogRef.close(true);
        return undefined;
      } catch (error) {
        return [{ kind: 'server', message: mapRecordExecutionError(error) }];
      }
    });
  }
}
