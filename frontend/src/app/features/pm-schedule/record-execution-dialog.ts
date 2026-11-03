import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { form, FormField, submit, validate } from '@angular/forms/signals';
import { MatButton } from '@angular/material/button';
import {
  MAT_DIALOG_DATA,
  MatDialogActions,
  MatDialogClose,
  MatDialogContent,
  MatDialogRef,
} from '@angular/material/dialog';
import { MatError, MatFormField, MatHint, MatLabel, MatSuffix } from '@angular/material/form-field';
import { MatInput } from '@angular/material/input';
import { MatIcon } from '@angular/material/icon';
import { firstValueFrom } from 'rxjs';

import { formatJalaliCalendarDate } from '../../core/date/calendar-date';
import { PmPlansGateway } from '../../core/maintenance/pm-plans-gateway';
import { AppDailyPmTask } from '../../core/maintenance/pm-schedule-gateway';
import { DialogHead } from '../../ui/dialog-head/dialog-head';
import { ErrorBanner } from '../../ui/error-banner/error-banner';
import { Icon } from '../../ui/icon/icon';
import { operatingHoursError, parseOperatingHours } from './operating-hours';
import { mapRecordExecutionFormError, RecordExecutionFormModel } from './server-errors';

export interface RecordExecutionDialogData {
  readonly task: AppDailyPmTask;
}

/**
 * «ثبت انجام» for one task of today's list: the job was done, now, by whoever is signed in — there
 * is no back-dating and no other outcome. Notes and the equipment's operating hours (issue #108)
 * are optional; the hours are a text input, so whatever is typed can be told apart from a reading
 * («دوازده» is refused on the field on submit, with nothing sent). Which occurrence it lands on is
 * the API's rule; the dialog only names the one the list showed.
 */
@Component({
  selector: 'app-record-execution-dialog',
  imports: [
    DialogHead,
    ErrorBanner,
    FormField,
    Icon,
    MatButton,
    MatDialogActions,
    MatDialogClose,
    MatDialogContent,
    MatError,
    MatFormField,
    MatHint,
    MatIcon,
    MatInput,
    MatLabel,
    MatSuffix,
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

        <!-- Dynamic subscript: the error is a sentence, and must wrap rather than be cut off. -->
        <mat-form-field appearance="outline" subscriptSizing="dynamic">
          <mat-label>ساعت کارکرد دستگاه</mat-label>
          <input
            matInput
            type="text"
            inputmode="decimal"
            autocomplete="off"
            [formField]="recordForm.operatingHours"
          />
          <span matTextSuffix>ساعت</span>
          @if (
            recordForm.operatingHours().touched() && recordForm.operatingHours().errors().length
          ) {
            <mat-error>{{ recordForm.operatingHours().errors()[0].message }}</mat-error>
          } @else {
            <mat-hint>اختیاری؛ از آخرین انجام این فعالیت روی تجهیز</mat-hint>
          }
        </mat-form-field>
      </mat-dialog-content>

      <mat-dialog-actions class="dialog-footer">
        <button matButton type="button" mat-dialog-close>
          <mat-icon appIcon="cancel" />انصراف
        </button>
        <button matButton="filled" type="submit" [disabled]="recordForm().submitting()">
          <mat-icon appIcon="check-circle" />
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

  private readonly model = signal<RecordExecutionFormModel>({ notes: '', operatingHours: '' });
  protected readonly recordForm = form(this.model, (path) => {
    validate(path.operatingHours, ({ value }) => {
      const message = operatingHoursError(value());
      return message === undefined ? undefined : { kind: 'operatingHours', message };
    });
  });

  protected onSubmit(): Promise<boolean> {
    return submit(this.recordForm, async () => {
      try {
        const { equipmentId, planItemId } = this.data.task;
        const { notes, operatingHours } = this.model();
        await firstValueFrom(
          this.gateway.recordExecution(equipmentId, planItemId, {
            notes,
            // Valid by now (the validator stops the submit otherwise), so never `undefined`.
            operatingHours: parseOperatingHours(operatingHours) ?? null,
          }),
        );
        this.dialogRef.close(true);
        return undefined;
      } catch (error) {
        return mapRecordExecutionFormError(error, this.recordForm);
      }
    });
  }
}
