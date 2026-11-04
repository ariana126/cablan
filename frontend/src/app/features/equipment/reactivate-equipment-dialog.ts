import { ChangeDetectionStrategy, Component, inject, linkedSignal } from '@angular/core';
import { rxResource } from '@angular/core/rxjs-interop';
import { applyEach, form, FormField, required, submit, validate } from '@angular/forms/signals';
import { MatButton } from '@angular/material/button';
import {
  MAT_DIALOG_DATA,
  MatDialogActions,
  MatDialogClose,
  MatDialogContent,
  MatDialogRef,
} from '@angular/material/dialog';
import { MatIcon } from '@angular/material/icon';
import { MatProgressBar } from '@angular/material/progress-bar';
import { MatRadioButton, MatRadioGroup } from '@angular/material/radio';
import { firstValueFrom } from 'rxjs';

import { toIsoCalendarDate } from '../../core/date/calendar-date';
import { tehranToday } from '../../core/date/tehran-today';
import {
  AppEquipment,
  AppPmPlanItem,
  EquipmentGateway,
  RescheduledPlanItem,
} from '../../core/maintenance/equipment-gateway';
import { DialogHead } from '../../ui/dialog-head/dialog-head';
import { ErrorBanner } from '../../ui/error-banner/error-banner';
import { Icon } from '../../ui/icon/icon';
import { JalaliDatetimeField } from '../../ui/jalali-datetime-field/jalali-datetime-field';
import { mapReactivateError } from './server-errors';

export interface ReactivateEquipmentDialogData {
  readonly equipment: AppEquipment;
}

/** How one active plan row resumes. */
type Resumption = 'continue' | 'restart';

interface ReactivationRow {
  readonly planItemId: string;
  readonly activityName: string;
  readonly resumption: Resumption;
  /** The picked day at local midnight; `null` until one is picked (the date field's own shape). */
  readonly firstDueDate: Date | null;
}

interface ReactivationFormModel {
  readonly rows: readonly ReactivationRow[];
}

const NEW_FIRST_DUE_DATE = 'اولین موعد تازه';

const RESUMPTIONS: readonly { readonly value: Resumption; readonly label: string }[] = [
  { value: 'continue', label: 'ادامه برنامه قبلی' },
  { value: 'restart', label: 'تعیین اولین موعد تازه' },
];

let nextDialogId = 0;

const toRow = (item: AppPmPlanItem): ReactivationRow => ({
  planItemId: item.id,
  activityName: item.activityName,
  resumption: 'continue',
  firstDueDate: null,
});

/**
 * The System Admin puts retired equipment back in service (issue #110). Each **active** plan row
 * resumes one of two ways, chosen per row: «ادامه برنامه قبلی» (the default — its calendar goes on
 * as if never stopped, the due dates of the retirement skipped) or «تعیین اولین موعد تازه», a new
 * first due date on the Jalali calendar, today or later, keeping its interval. Deactivated rows stay
 * deactivated and are not offered. Each row's choice is a `mat-radio-group` named exactly by its
 * activity (`aria-labelledby`); its date field is labelled «اولین موعد تازه {activity}», unique in
 * the dialog. The API's refusals (a date before today, a row no longer active, …) are the dialog's
 * alert. Closes with `true` once reactivated.
 */
@Component({
  selector: 'app-reactivate-equipment-dialog',
  imports: [
    DialogHead,
    ErrorBanner,
    FormField,
    Icon,
    JalaliDatetimeField,
    MatButton,
    MatDialogActions,
    MatDialogClose,
    MatDialogContent,
    MatIcon,
    MatProgressBar,
    MatRadioButton,
    MatRadioGroup,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <app-dialog-head heading="فعال سازی دوباره تجهیز" [subtitle]="data.equipment.name" />

    <form novalidate (submit)="onSubmit(); $event.preventDefault()">
      <mat-dialog-content class="stack stack--tight" tabindex="0">
        @if (reactivationForm().errors().length) {
          <app-error-banner [message]="reactivationForm().errors()[0].message ?? ''" />
        }

        <p class="reactivation__intro">
          تجهیز دوباره در خدمت قرار می‌گیرد. برای هر فعالیت برنامه بگویید از برنامهٔ قبلی ادامه دهد
          یا از اولین موعد تازه شروع شود. فعالیت‌های غیرفعال، غیرفعال می‌مانند.
        </p>

        @if (plan.isLoading()) {
          <mat-progress-bar mode="indeterminate" aria-label="در حال بارگذاری برنامهٔ تجهیز" />
        } @else if (plan.error()) {
          <app-error-banner
            message="برنامهٔ این تجهیز بارگذاری نشد."
            retryLabel="تلاش دوباره"
            (retry)="plan.reload()"
          />
        } @else if (reactivationForm.rows.length === 0) {
          <p class="reactivation__empty">این تجهیز فعالیت فعالی در برنامه ندارد.</p>
        } @else {
          <ul class="reactivation-list">
            @for (row of reactivationForm.rows; track $index; let index = $index) {
              <li class="reactivation-row">
                <span class="reactivation-row__name" [id]="nameId(index)">
                  {{ row.activityName().value() }}
                </span>
                <mat-radio-group
                  class="reactivation-row__choices"
                  [formField]="row.resumption"
                  [attr.aria-labelledby]="nameId(index)"
                >
                  @for (choice of resumptions; track choice.value) {
                    <mat-radio-button [value]="choice.value">{{ choice.label }}</mat-radio-button>
                  }
                </mat-radio-group>
                @if (row.resumption().value() === 'restart') {
                  <app-jalali-datetime-field
                    class="reactivation-row__date"
                    [field]="row.firstDueDate"
                    [dateLabel]="newFirstDueDateLabel(row.activityName().value())"
                    [boundName]="newFirstDueDateLabel(row.activityName().value())"
                    [withTime]="false"
                    [notBefore]="today"
                  />
                }
              </li>
            }
          </ul>
        }
      </mat-dialog-content>

      <mat-dialog-actions class="dialog-footer">
        <button matButton type="button" mat-dialog-close>
          <mat-icon appIcon="cancel" />انصراف
        </button>
        <button
          matButton="filled"
          type="submit"
          [disabled]="!plan.hasValue() || reactivationForm().submitting()"
        >
          <mat-icon appIcon="retry" />
          فعال سازی دوباره
        </button>
      </mat-dialog-actions>
    </form>
  `,
  styleUrl: './reactivate-equipment-dialog.scss',
})
export class ReactivateEquipmentDialog {
  private readonly dialogRef = inject(MatDialogRef<ReactivateEquipmentDialog, boolean>);
  protected readonly data = inject<ReactivateEquipmentDialogData>(MAT_DIALOG_DATA);
  private readonly gateway = inject(EquipmentGateway);

  protected readonly resumptions = RESUMPTIONS;
  private readonly idPrefix = `reactivation-${nextDialogId++}`;

  /** The calendar's earliest day. A dialog lives minutes, so the day it opened on is today's. */
  protected readonly today = tehranToday();

  /** The equipment's active rows — the list shows names only, so the folder's read is all it needs. */
  protected readonly plan = rxResource({
    stream: () => this.gateway.get(this.data.equipment.id),
  });

  private readonly model = linkedSignal<ReactivationFormModel>(() => ({
    rows: this.plan.hasValue() ? this.plan.value().planItems.map(toRow) : [],
  }));

  protected readonly reactivationForm = form(this.model, (path) => {
    applyEach(path.rows, (row) => {
      required(row.firstDueDate, {
        message: `${NEW_FIRST_DUE_DATE} را انتخاب کنید.`,
        when: ({ valueOf }) => valueOf(row.resumption) === 'restart',
      });
      // The calendar closes earlier days; this says why, should one get through anyway.
      validate(row.firstDueDate, ({ value, valueOf }) => {
        const day = value();
        return valueOf(row.resumption) === 'restart' &&
          day !== null &&
          day.getTime() < tehranToday().getTime()
          ? { kind: 'min', message: `${NEW_FIRST_DUE_DATE} نمی‌تواند پیش از امروز باشد.` }
          : undefined;
      });
    });
  });

  protected nameId(index: number): string {
    return `${this.idPrefix}-name-${index}`;
  }

  protected newFirstDueDateLabel(activityName: string): string {
    return `${NEW_FIRST_DUE_DATE} ${activityName}`;
  }

  protected onSubmit(): Promise<boolean> {
    return submit(this.reactivationForm, async () => {
      const rescheduled: RescheduledPlanItem[] = this.model().rows.flatMap((row) =>
        row.resumption === 'restart' && row.firstDueDate !== null
          ? [{ planItemId: row.planItemId, firstDueDate: toIsoCalendarDate(row.firstDueDate) }]
          : [],
      );
      try {
        await firstValueFrom(this.gateway.reactivate(this.data.equipment.id, rescheduled));
        this.dialogRef.close(true);
        return undefined;
      } catch (error) {
        return [{ kind: 'server', message: mapReactivateError(error) }];
      }
    });
  }
}
