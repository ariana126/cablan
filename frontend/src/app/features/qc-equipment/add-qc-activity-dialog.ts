import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { rxResource } from '@angular/core/rxjs-interop';
import { form, required, submit } from '@angular/forms/signals';
import { MatButton } from '@angular/material/button';
import {
  MAT_DIALOG_DATA,
  MatDialogActions,
  MatDialogClose,
  MatDialogContent,
  MatDialogRef,
} from '@angular/material/dialog';
import { MatIcon } from '@angular/material/icon';
import { firstValueFrom } from 'rxjs';

import { AppQcActivity, QcActivitiesGateway } from '../../core/qc/qc-activities-gateway';
import { QcEquipmentGateway } from '../../core/qc/qc-equipment-gateway';
import { DialogHead } from '../../ui/dialog-head/dialog-head';
import { ErrorBanner } from '../../ui/error-banner/error-banner';
import { RevealFormErrors } from '../../ui/reveal-form-errors/reveal-form-errors';
import { Icon } from '../../ui/icon/icon';
import {
  SearchableSelect,
  SearchableSelectOption,
} from '../../ui/searchable-select/searchable-select';
import { mapAssignError } from './server-errors';

export interface AddQcActivityDialogData {
  readonly equipment: { readonly id: string; readonly name: string };
  /** The activities assigned to it now — not offered again. */
  readonly assignedActivityIds: readonly string[];
}

interface AddQcActivityFormModel {
  readonly activityId: string;
}

/**
 * Assigns one QC activity of the catalog to an equipment, from its QC folder («افزودن فعالیت»). The
 * picker offers only the activities not assigned to it yet; one assigned meanwhile is still the
 * API's 409, shown on the picker. Closes with `true` once assigned.
 */
@Component({
  selector: 'app-add-qc-activity-dialog',
  imports: [
    DialogHead,
    ErrorBanner,
    RevealFormErrors,
    Icon,
    MatButton,
    MatDialogActions,
    MatDialogClose,
    MatDialogContent,
    MatIcon,
    SearchableSelect,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <app-dialog-head heading="افزودن فعالیت QC" [subtitle]="data.equipment.name" />

    <form
      [appRevealFormErrors]="assignForm"
      novalidate
      (submit)="onSubmit(); $event.preventDefault()"
    >
      <mat-dialog-content class="stack">
        @if (assignForm().errors().length) {
          <app-error-banner [message]="assignForm().errors()[0].message ?? ''" />
        }
        @if (catalogResource.error()) {
          <app-error-banner
            message="فهرست فعالیت‌های QC بارگذاری نشد."
            retryLabel="تلاش دوباره"
            (retry)="catalogResource.reload()"
          />
        } @else if (catalogResource.hasValue() && options().length === 0) {
          <p class="dialog-notice">
            <mat-icon appIcon="info" />
            @if (catalogResource.value().length === 0) {
              هنوز هیچ فعالیت QC تعریف نشده است؛ فعالیت‌ها در «اطلاعات پایه › فعالیت‌های QC» تعریف
              می‌شوند.
            } @else {
              همهٔ فعالیت‌های QC به این تجهیز تخصیص داده شده است.
            }
          </p>
        }

        <app-searchable-select
          label="فعالیت QC"
          [field]="assignForm.activityId"
          [options]="options()"
        />
      </mat-dialog-content>

      <mat-dialog-actions class="dialog-footer">
        <button matButton type="button" mat-dialog-close>
          <mat-icon appIcon="cancel" />انصراف
        </button>
        <button matButton="filled" type="submit" [disabled]="assignForm().submitting()">
          <mat-icon appIcon="add" />افزودن
        </button>
      </mat-dialog-actions>
    </form>
  `,
  styleUrl: './add-qc-activity-dialog.scss',
})
export class AddQcActivityDialog {
  private readonly dialogRef = inject(MatDialogRef<AddQcActivityDialog, boolean>);
  protected readonly data = inject<AddQcActivityDialogData>(MAT_DIALOG_DATA);
  private readonly catalog = inject(QcActivitiesGateway);
  private readonly equipment = inject(QcEquipmentGateway);

  protected readonly catalogResource = rxResource({
    stream: () => this.catalog.list(),
    defaultValue: [] as AppQcActivity[],
  });

  protected readonly options = computed<SearchableSelectOption[]>(() =>
    (this.catalogResource.hasValue() ? this.catalogResource.value() : [])
      .filter((activity) => !this.data.assignedActivityIds.includes(activity.id))
      .map((activity) => ({ value: activity.id, label: activity.name })),
  );

  private readonly model = signal<AddQcActivityFormModel>({ activityId: '' });
  protected readonly assignForm = form(this.model, (path) => {
    required(path.activityId, { message: 'فعالیت QC را انتخاب کنید.' });
  });

  protected onSubmit(): Promise<boolean> {
    return submit(this.assignForm, async () => {
      try {
        await firstValueFrom(
          this.equipment.assign(this.data.equipment.id, this.model().activityId),
          { defaultValue: undefined },
        );
        this.dialogRef.close(true);
        return undefined;
      } catch (error) {
        return mapAssignError(error, this.assignForm.activityId);
      }
    });
  }
}
