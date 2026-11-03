import { HttpErrorResponse } from '@angular/common/http';
import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { applyEach, form, FormField, required, submit } from '@angular/forms/signals';
import { MatButton } from '@angular/material/button';
import {
  MAT_DIALOG_DATA,
  MatDialogActions,
  MatDialogContent,
  MatDialogRef,
} from '@angular/material/dialog';
import { MatError } from '@angular/material/form-field';
import { MatIcon } from '@angular/material/icon';
import { MatRadioButton, MatRadioGroup } from '@angular/material/radio';
import { firstValueFrom } from 'rxjs';

import { PROBLEM, toProblemDetails } from '../../core/http/problem-details';
import { ActivitySpecialty, SPECIALTY_LABELS } from '../../core/i18n/specialty-labels';
import {
  AppUnassignedActivity,
  MaintenanceActivitiesGateway,
} from '../../core/maintenance/maintenance-activities-gateway';
import { DialogHead } from '../../ui/dialog-head/dialog-head';
import { ErrorBanner } from '../../ui/error-banner/error-banner';
import { Icon } from '../../ui/icon/icon';

export interface SpecialtyAssignmentDialogData {
  /** Every activity without a specialty, as `GET …/unassigned-specialties` listed them. */
  readonly activities: readonly AppUnassignedActivity[];
}

interface AssignmentLine {
  readonly activityId: string;
  readonly name: string;
  /** `''` until chosen. */
  readonly specialty: ActivitySpecialty | '';
}

interface SpecialtyAssignmentFormModel {
  readonly assignments: readonly AssignmentLine[];
}

/** Said when a choice is missing, here or (`specialty-assignment-incomplete`) by the API. */
export const EVERY_SPECIALTY_REQUIRED = 'تخصص همه فعالیت ها باید تعیین شود.';

const LINE_SPECIALTY_REQUIRED = 'تخصص این فعالیت را انتخاب کنید.';

const SPECIALTY_CHOICES = (Object.keys(SPECIALTY_LABELS) as ActivitySpecialty[]).map((value) => ({
  value,
  label: SPECIALTY_LABELS[value],
}));

let nextDialogId = 0;

/**
 * «تعیین تخصص فعالیت های قبلی» (issue #108): activities registered before specialties existed get
 * one each, all at once — the system admin's one-time completion. Opened by
 * `SpecialtyAssignmentPrompt` with `disableClose`, so neither Escape nor a click outside dismisses it
 * by accident; «بعداً» puts it off on purpose, and it opens again at the next sign-in.
 *
 * Each activity is a row: its name, and a `mat-radio-group` named exactly by that name
 * (`aria-labelledby` the name) holding «برق» and «مکانیک», neither chosen. «ثبت تخصص ها» never
 * disables; submitting with a choice missing marks that row and says, in the dialog's alert, that
 * every activity needs one — and sends nothing. The API is all-or-nothing too
 * (`specialty-assignment-incomplete`), said in the same words.
 */
@Component({
  selector: 'app-specialty-assignment-dialog',
  imports: [
    DialogHead,
    ErrorBanner,
    FormField,
    Icon,
    MatButton,
    MatDialogActions,
    MatDialogContent,
    MatError,
    MatIcon,
    MatRadioButton,
    MatRadioGroup,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <app-dialog-head
      heading="تعیین تخصص فعالیت های قبلی"
      subtitle="این فعالیت‌ها پیش از تعیین تخصص ثبت شده‌اند. تخصص هر کدام را انتخاب کنید."
      [showClose]="false"
    />

    <form novalidate (submit)="onSubmit(); $event.preventDefault()">
      <mat-dialog-content class="stack stack--tight" tabindex="0">
        @if (assignmentForm().errors().length) {
          <app-error-banner [message]="assignmentForm().errors()[0].message ?? ''" />
        } @else if (incomplete() && !assignmentForm().valid()) {
          <app-error-banner [message]="everySpecialtyRequired" />
        }

        <ul class="assignment-list">
          @for (line of assignmentForm.assignments; track $index; let index = $index) {
            <li class="assignment">
              <span class="assignment__name" [id]="nameId(index)">{{ line.name().value() }}</span>
              <mat-radio-group
                class="assignment__choices"
                [formField]="line.specialty"
                [attr.aria-labelledby]="nameId(index)"
                aria-required="true"
                [attr.aria-invalid]="invalid(index)"
                [attr.aria-describedby]="invalid(index) ? errorId(index) : null"
              >
                @for (choice of specialtyChoices; track choice.value) {
                  <mat-radio-button [value]="choice.value">{{ choice.label }}</mat-radio-button>
                }
              </mat-radio-group>
              @if (invalid(index)) {
                <mat-error class="assignment__error" [id]="errorId(index)">
                  {{ line.specialty().errors()[0].message }}
                </mat-error>
              }
            </li>
          }
        </ul>
      </mat-dialog-content>

      <mat-dialog-actions class="dialog-footer">
        <button matButton type="button" (click)="putOff()">
          <mat-icon appIcon="close" />بعداً
        </button>
        <button matButton="filled" type="submit" [disabled]="assignmentForm().submitting()">
          <mat-icon appIcon="check" />
          ثبت تخصص ها
        </button>
      </mat-dialog-actions>
    </form>
  `,
  styleUrl: './specialty-assignment-dialog.scss',
})
export class SpecialtyAssignmentDialog {
  private readonly dialogRef = inject(MatDialogRef<SpecialtyAssignmentDialog, boolean>);
  private readonly data = inject<SpecialtyAssignmentDialogData>(MAT_DIALOG_DATA);
  private readonly gateway = inject(MaintenanceActivitiesGateway);

  protected readonly specialtyChoices = SPECIALTY_CHOICES;
  protected readonly everySpecialtyRequired = EVERY_SPECIALTY_REQUIRED;
  private readonly idPrefix = `specialty-assignment-${nextDialogId++}`;

  private readonly model = signal<SpecialtyAssignmentFormModel>({
    assignments: this.data.activities.map(({ id, name }) => ({
      activityId: id,
      name,
      specialty: '',
    })),
  });

  protected readonly assignmentForm = form(this.model, (path) => {
    applyEach(path.assignments, (line) => {
      required(line.specialty, { message: LINE_SPECIALTY_REQUIRED });
    });
  });

  /** Set by a submit that found a choice missing — the alert says so until all are chosen. */
  protected readonly incomplete = signal(false);

  protected nameId(index: number): string {
    return `${this.idPrefix}-name-${index}`;
  }

  protected errorId(index: number): string {
    return `${this.idPrefix}-error-${index}`;
  }

  protected invalid(index: number): boolean {
    const field = this.assignmentForm.assignments[index].specialty();
    return field.touched() && field.errors().length > 0;
  }

  protected putOff(): void {
    this.dialogRef.close(false);
  }

  protected onSubmit(): Promise<boolean> {
    this.incomplete.set(!this.assignmentForm().valid());
    return submit(this.assignmentForm, async () => {
      try {
        await firstValueFrom(
          this.gateway.assignSpecialties(
            this.model().assignments.flatMap(({ activityId, specialty }) =>
              specialty === '' ? [] : [{ activityId, specialty }],
            ),
          ),
        );
        this.dialogRef.close(true);
        return undefined;
      } catch (error) {
        return [{ kind: 'server', message: assignmentErrorMessage(error) }];
      }
    });
  }
}

/** Branches on `type`, never `detail`; every message is the client's own Persian. */
function assignmentErrorMessage(error: unknown): string {
  if (error instanceof HttpErrorResponse && error.status === 403) {
    return 'شما اجازهٔ انجام این عملیات را ندارید.';
  }
  switch (toProblemDetails(error)?.type) {
    case undefined:
      return 'خطایی در برقراری ارتباط با سرور رخ داد. دوباره تلاش کنید.';
    case PROBLEM.specialtyAssignmentIncomplete:
      return EVERY_SPECIALTY_REQUIRED;
    default:
      return 'ثبت تخصص ها ممکن نشد. دوباره تلاش کنید.';
  }
}
