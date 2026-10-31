import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { rxResource } from '@angular/core/rxjs-interop';
import { form, FormField, required, submit } from '@angular/forms/signals';
import { MatButton } from '@angular/material/button';
import {
  MAT_DIALOG_DATA,
  MatDialogActions,
  MatDialogClose,
  MatDialogContent,
  MatDialogRef,
} from '@angular/material/dialog';
import { MatError, MatFormField, MatLabel } from '@angular/material/form-field';
import { MatInput } from '@angular/material/input';
import { MatIcon } from '@angular/material/icon';
import { firstValueFrom } from 'rxjs';

import { toIsoCalendarDate } from '../../core/date/calendar-date';
import {
  AppMaintenanceActivity,
  MaintenanceActivitiesGateway,
} from '../../core/maintenance/maintenance-activities-gateway';
import { PmPlansGateway } from '../../core/maintenance/pm-plans-gateway';
import { DialogHead } from '../../ui/dialog-head/dialog-head';
import { ErrorBanner } from '../../ui/error-banner/error-banner';
import { JalaliDatetimeField } from '../../ui/jalali-datetime-field/jalali-datetime-field';
import {
  SearchableSelect,
  SearchableSelectOption,
} from '../../ui/searchable-select/searchable-select';
import { mapPlanItemFormError, wholeDays } from './server-errors';
import { Icon } from '../../ui/icon/icon';

export interface PmPlanEquipment {
  readonly id: string;
  readonly name: string;
}

/**
 * Opened either for one piece of equipment (its plan sheet's «افزودن فعالیت»), or for none, with
 * the equipment to choose from (the page's «تعریف برنامه برای تجهیز»).
 */
export type AddPmPlanItemDialogData =
  { readonly equipment: PmPlanEquipment } | { readonly candidates: readonly PmPlanEquipment[] };

/** Closes with the id of the equipment the activity was added to; with nothing when cancelled. */
export type AddPmPlanItemDialogResult = string | undefined;

interface AddPmPlanItemFormModel {
  /** Pre-set when the dialog was opened for one equipment; chosen in it otherwise. */
  readonly equipmentId: string;
  readonly activityId: string;
  /** `NaN` while the number input is empty. */
  readonly intervalDays: number;
  /** The picked day at local midnight; `null` until one is picked (the date field's own shape). */
  readonly firstDueDate: Date | null;
}

/**
 * Adds an activity to one equipment's PM plan: which activity, every how many days, and the first
 * due date, picked on the Jalali calendar. The interval is days only — the API's operating-hours
 * unit is not offered.
 *
 * Opened with `candidates` instead of an `equipment`, it is «تعریف برنامه برای تجهیز»: a «تجهیز»
 * picker comes first, its options named by the equipment alone, and the rest is the same form. It
 * closes with the chosen equipment's id either way, so the page can select it.
 *
 * The picker offers **every** activity of the catalog, ones already in this plan included: "at most
 * once per plan" is the API's rule, and its 409 is shown as the dialog's alert, so the visitor
 * learns why rather than finding the activity silently missing.
 */
@Component({
  selector: 'app-add-pm-plan-item-dialog',
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
    MatError,
    MatFormField,
    MatIcon,
    MatInput,
    MatLabel,
    SearchableSelect,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (fixedEquipment; as equipment) {
      <app-dialog-head heading="افزودن فعالیت به برنامه" [subtitle]="equipment.name" />
    } @else {
      <app-dialog-head heading="تعریف برنامه برای تجهیز" />
    }

    <form novalidate (submit)="onSubmit(); $event.preventDefault()">
      <mat-dialog-content class="stack">
        @if (itemForm().errors().length) {
          <app-error-banner [message]="itemForm().errors()[0].message ?? ''" />
        }
        @if (activitiesResource.error()) {
          <app-error-banner
            message="فهرست فعالیت‌ها بارگذاری نشد."
            retryLabel="تلاش دوباره"
            (retry)="activitiesResource.reload()"
          />
        }

        @if (!fixedEquipment) {
          <app-searchable-select
            label="تجهیز"
            [field]="itemForm.equipmentId"
            [options]="equipmentOptions"
          />
        }

        <app-searchable-select
          label="فعالیت"
          [field]="itemForm.activityId"
          [options]="activityOptions()"
        />

        <mat-form-field appearance="outline">
          <mat-label>دوره (روز)</mat-label>
          <input matInput type="number" step="1" [formField]="itemForm.intervalDays" />
          @if (itemForm.intervalDays().touched() && itemForm.intervalDays().errors().length) {
            <mat-error>{{ itemForm.intervalDays().errors()[0].message }}</mat-error>
          }
        </mat-form-field>

        <app-jalali-datetime-field
          [field]="itemForm.firstDueDate"
          dateLabel="اولین موعد"
          boundName="اولین موعد"
          [withTime]="false"
        />
      </mat-dialog-content>

      <mat-dialog-actions class="dialog-footer">
        <button matButton type="button" mat-dialog-close>
          <mat-icon appIcon="cancel" />انصراف
        </button>
        <button matButton="filled" type="submit" [disabled]="itemForm().submitting()">
          <mat-icon appIcon="check" />ثبت
        </button>
      </mat-dialog-actions>
    </form>
  `,
  styleUrl: './pm-plan-dialog.scss',
})
export class AddPmPlanItemDialog {
  private readonly dialogRef = inject(MatDialogRef<AddPmPlanItemDialog, AddPmPlanItemDialogResult>);
  private readonly data = inject<AddPmPlanItemDialogData>(MAT_DIALOG_DATA);

  /** The equipment the dialog was opened for, if any — otherwise the visitor chooses it. */
  protected readonly fixedEquipment = 'equipment' in this.data ? this.data.equipment : undefined;

  protected readonly equipmentOptions: readonly SearchableSelectOption[] =
    'candidates' in this.data
      ? this.data.candidates.map((equipment) => ({ value: equipment.id, label: equipment.name }))
      : [];
  private readonly activitiesGateway = inject(MaintenanceActivitiesGateway);
  private readonly plansGateway = inject(PmPlansGateway);

  protected readonly activitiesResource = rxResource({
    stream: () => this.activitiesGateway.list(),
    defaultValue: [] as AppMaintenanceActivity[],
  });

  protected readonly activityOptions = computed<SearchableSelectOption[]>(() =>
    (this.activitiesResource.hasValue() ? this.activitiesResource.value() : []).map((activity) => ({
      value: activity.id,
      label: activity.name,
    })),
  );

  private readonly model = signal<AddPmPlanItemFormModel>({
    equipmentId: this.fixedEquipment?.id ?? '',
    activityId: '',
    intervalDays: Number.NaN,
    firstDueDate: null,
  });

  protected readonly itemForm = form(this.model, (path) => {
    required(path.equipmentId, { message: 'تجهیز را انتخاب کنید.' });
    required(path.activityId, { message: 'فعالیت را انتخاب کنید.' });
    wholeDays(path.intervalDays);
    required(path.firstDueDate, { message: 'اولین موعد را انتخاب کنید.' });
  });

  protected onSubmit(): Promise<boolean> {
    return submit(this.itemForm, async () => {
      const { equipmentId, activityId, intervalDays, firstDueDate } = this.model();
      try {
        await firstValueFrom(
          this.plansGateway.addItem(equipmentId, {
            activityId,
            intervalDays,
            // `required` has already refused a missing date by the time this runs.
            firstDueDate: toIsoCalendarDate(firstDueDate as Date),
          }),
        );
        this.dialogRef.close(equipmentId);
        return undefined;
      } catch (error) {
        return mapPlanItemFormError(error, {
          activityId: this.itemForm.activityId,
          intervalDays: this.itemForm.intervalDays,
          firstDueDate: this.itemForm.firstDueDate,
        });
      }
    });
  }
}
