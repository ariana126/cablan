import {
  afterNextRender,
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  inject,
  Injector,
  signal,
} from '@angular/core';
import { form, FormField, maxLength, required, submit, validate } from '@angular/forms/signals';
import { MatButton } from '@angular/material/button';
import { MAT_DIALOG_DATA, MatDialogContent } from '@angular/material/dialog';
import { MatError, MatFormField, MatHint, MatLabel } from '@angular/material/form-field';
import { MatIcon } from '@angular/material/icon';
import { MatInput } from '@angular/material/input';
import { firstValueFrom } from 'rxjs';

import { AppQcActivityStatus, AppQcEquipment } from '../../core/qc/qc-equipment-gateway';
import { QcInspectionsGateway } from '../../core/qc/qc-inspections-gateway';
import { qcLastExecution } from '../../core/qc/qc-time';
import { DialogHead } from '../../ui/dialog-head/dialog-head';
import { ErrorBanner } from '../../ui/error-banner/error-banner';
import { RevealFormErrors } from '../../ui/reveal-form-errors/reveal-form-errors';
import { Icon } from '../../ui/icon/icon';
import {
  mapQcRecordError,
  NOTES_MAX_LENGTH,
  NOTES_TOO_LONG,
  QcRecordFormModel,
  TRACKING_NUMBER_MAX_LENGTH,
  TRACKING_NUMBER_REQUIRED,
  TRACKING_NUMBER_TOO_LONG,
} from './server-errors';

export interface QcRecordDialogData {
  /** A scanned equipment that can be recorded on: in service, with activities assigned. */
  readonly equipment: AppQcEquipment;
}

const EMPTY_RECORD: QcRecordFormModel = { trackingNumber: '', notes: '' };

/**
 * The scanned equipment's inspection (issue #119): its name as the dialog's title, and each of its
 * assigned activities with its last execution and **its own** «ثبت انجام» — one activity at a time,
 * so the form's labels stay unique. «ثبت انجام {activity}» opens that activity's form in the dialog:
 * «شماره ردیابی» (required, any text; blank or spaces is the field's error, nothing sent) and
 * optional «توضیحات». A record goes back to the list with «انجام «…» ثبت شد.» and the list re-read,
 * so another activity can be recorded straight after; «بازگشت به فهرست» goes back without one.
 * Who and when are the API's (the token and its clock). The head's «بستن» closes it; the page then
 * re-reads its own list.
 */
@Component({
  selector: 'app-qc-record-dialog',
  imports: [
    DialogHead,
    ErrorBanner,
    RevealFormErrors,
    FormField,
    Icon,
    MatButton,
    MatDialogContent,
    MatError,
    MatFormField,
    MatHint,
    MatIcon,
    MatInput,
    MatLabel,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <app-dialog-head [heading]="equipment().name" subtitle="ثبت انجام فعالیت‌های QC" />

    <mat-dialog-content class="stack stack--tight">
      <p class="record-status" role="status">{{ recorded() }}</p>

      @if (recording(); as activity) {
        <form
          [appRevealFormErrors]="recordForm"
          novalidate
          class="record-form stack stack--tight"
          (submit)="onSubmit(); $event.preventDefault()"
        >
          <h3 class="record-form__title">{{ activity.activityName }}</h3>
          <p class="record-form__last">
            آخرین انجام: {{ lastExecution(activity.lastPerformedAt) }}
          </p>

          @if (recordForm().errors().length) {
            <app-error-banner [message]="recordForm().errors()[0].message ?? ''" />
          }

          <mat-form-field appearance="outline">
            <mat-label>شماره ردیابی</mat-label>
            <input
              #trackingNumber
              matInput
              type="text"
              autocomplete="off"
              [formField]="recordForm.trackingNumber"
            />
            @if (
              recordForm.trackingNumber().touched() && recordForm.trackingNumber().errors().length
            ) {
              <mat-error>{{ recordForm.trackingNumber().errors()[0].message }}</mat-error>
            }
          </mat-form-field>

          <mat-form-field appearance="outline">
            <mat-label>توضیحات</mat-label>
            <textarea matInput rows="3" [formField]="recordForm.notes"></textarea>
            @if (recordForm.notes().errors().length) {
              <mat-error>{{ recordForm.notes().errors()[0].message }}</mat-error>
            } @else {
              <mat-hint>اختیاری</mat-hint>
            }
          </mat-form-field>

          <div class="record-form__actions">
            <button matButton type="button" (click)="backToList()">
              <mat-icon appIcon="back" />
              بازگشت به فهرست
            </button>
            <button matButton="filled" type="submit" [disabled]="recordForm().submitting()">
              <mat-icon appIcon="check-circle" />
              ثبت انجام
            </button>
          </div>
        </form>
      } @else {
        <ul class="activity-list" aria-label="فعالیت‌های QC تجهیز">
          @for (activity of equipment().activities; track activity.activityId) {
            <li class="activity-list__item">
              <span class="activity-list__text stack stack--hair">
                <span class="activity-list__name">{{ activity.activityName }}</span>
                <span class="activity-list__last">
                  آخرین انجام: {{ lastExecution(activity.lastPerformedAt) }}
                </span>
              </span>
              <button
                matButton="outlined"
                type="button"
                [attr.data-activity]="activity.activityId"
                [attr.aria-label]="'ثبت انجام ' + activity.activityName"
                (click)="startRecording(activity)"
              >
                <mat-icon appIcon="check-circle" />
                ثبت انجام
              </button>
            </li>
          }
        </ul>
      }
    </mat-dialog-content>
  `,
  styleUrl: './qc-record-dialog.scss',
})
export class QcRecordDialog {
  private readonly data = inject<QcRecordDialogData>(MAT_DIALOG_DATA);
  private readonly gateway = inject(QcInspectionsGateway);
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly injector = inject(Injector);

  protected readonly lastExecution = qcLastExecution;

  /** The equipment as last read — re-read after every record, for its last executions. */
  protected readonly equipment = signal<AppQcEquipment>(this.data.equipment);
  /** The activity whose form is open, or `undefined` while the list shows. */
  protected readonly recording = signal<AppQcActivityStatus | undefined>(undefined);
  /** The confirmation of the last record, for the live region. */
  protected readonly recorded = signal('');

  private readonly model = signal<QcRecordFormModel>(EMPTY_RECORD);
  protected readonly recordForm = form(this.model, (path) => {
    required(path.trackingNumber, { message: TRACKING_NUMBER_REQUIRED });
    // Also write `maxlength` on the inputs, so neither can be typed past the API's limit.
    maxLength(path.trackingNumber, TRACKING_NUMBER_MAX_LENGTH, {
      message: TRACKING_NUMBER_TOO_LONG,
    });
    maxLength(path.notes, NOTES_MAX_LENGTH, { message: NOTES_TOO_LONG });
    validate(path.trackingNumber, ({ value }) =>
      value() !== '' && value().trim() === ''
        ? { kind: 'required', message: TRACKING_NUMBER_REQUIRED }
        : undefined,
    );
  });

  protected startRecording(activity: AppQcActivityStatus): void {
    this.model.set(EMPTY_RECORD);
    this.recordForm().reset();
    this.recorded.set('');
    this.recording.set(activity);
    this.focusAfterRender('input');
  }

  protected backToList(): void {
    const activity = this.recording();
    this.recording.set(undefined);
    if (activity !== undefined) {
      this.focusAfterRender(`button[data-activity="${activity.activityId}"]`);
    }
  }

  protected onSubmit(): Promise<boolean> {
    return submit(this.recordForm, async () => {
      const activity = this.recording();
      if (activity === undefined) {
        return undefined;
      }
      try {
        await firstValueFrom(
          this.gateway.record(this.equipment().id, activity.activityId, this.model()),
          { defaultValue: undefined },
        );
      } catch (error) {
        return mapQcRecordError(error, this.recordForm);
      }
      this.recorded.set(`انجام «${activity.activityName}» ثبت شد.`);
      this.backToList();
      void this.refresh();
      return undefined;
    });
  }

  /** The last executions moved; a failed re-read keeps the list as it was. */
  private async refresh(): Promise<void> {
    try {
      this.equipment.set(await firstValueFrom(this.gateway.get(this.equipment().id)));
    } catch {
      // The record is made; the old «آخرین انجام» is only stale until the next scan.
    }
  }

  private focusAfterRender(selector: string): void {
    afterNextRender(() => this.host.nativeElement.querySelector<HTMLElement>(selector)?.focus(), {
      injector: this.injector,
    });
  }
}
