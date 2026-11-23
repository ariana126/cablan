import {
  afterNextRender,
  ChangeDetectionStrategy,
  Component,
  computed,
  DestroyRef,
  ElementRef,
  inject,
  Injector,
  signal,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import {
  form,
  FormField,
  maxLength,
  readonly,
  required,
  submit,
  validate,
  ValidationError,
} from '@angular/forms/signals';
import { MatButton } from '@angular/material/button';
import {
  MAT_DIALOG_DATA,
  MatDialogActions,
  MatDialogContent,
  MatDialogRef,
} from '@angular/material/dialog';
import { MatError, MatFormField, MatLabel } from '@angular/material/form-field';
import { MatIcon } from '@angular/material/icon';
import { MatInput } from '@angular/material/input';
import { filter, firstValueFrom } from 'rxjs';

import { AppQcSubmissionResult, QcInspectionsGateway } from '../../core/qc/qc-inspections-gateway';
import { DialogHead } from '../../ui/dialog-head/dialog-head';
import { ErrorBanner } from '../../ui/error-banner/error-banner';
import { Icon } from '../../ui/icon/icon';
import { RevealFormErrors } from '../../ui/reveal-form-errors/reveal-form-errors';
import { QcPendingSubmission } from './qc-checklist';
import {
  qcRefusalReason,
  QcSubmissionFailure,
  qcSubmissionFailureOf,
  TRACKING_NUMBER_MAX_LENGTH,
  TRACKING_NUMBER_REQUIRED,
  TRACKING_NUMBER_TOO_LONG,
} from './server-errors';

/** One ticked activity, as the checklist hands it over. */
export interface QcTickedActivity {
  readonly activityId: string;
  readonly activityName: string;
  readonly notes: string;
}

export interface QcSubmissionDialogData {
  readonly equipment: { readonly id: string; readonly name: string };
  /** At least one, in the checklist's order. */
  readonly activities: readonly QcTickedActivity[];
  /**
   * The submission to send: a new id with no tracking number, or a pending one (sent before, no
   * answer came) with the tracking number it went with — shown locked, since the API refuses
   * another.
   */
  readonly submission: QcPendingSubmission;
}

/**
 * How the dialog closed: whether anything was sent (so the last executions may have moved), which
 * activities are recorded (so their ticks and notes can go), and whether the submission is
 * `settled` — every activity answered, or the whole of it refused, so nothing more can be recorded
 * under its id. An unsettled one (no answer came) must be sent again under the same id, with this
 * `trackingNumber`.
 */
export interface QcSubmissionOutcome {
  readonly sent: boolean;
  readonly recorded: readonly string[];
  readonly settled: boolean;
  readonly trackingNumber: string;
}

interface ShownResult {
  readonly activityId: string;
  readonly name: string;
  readonly recorded: boolean;
  readonly reason: string;
}

/**
 * «ثبت انجام» for one equipment's ticked activities (issue #132): the tracking number, typed once,
 * is sent with every one of them as one submission. Its `submissionId` comes from the checklist:
 * new for a new submission, the same one while an earlier sending of these very activities got no
 * answer (then the tracking number comes too, locked, under a notice). «ارسال دوباره» sends the
 * very same submission — which the API never records twice. The tracking number locks once sent,
 * since the API refuses a resend that changes it.
 *
 * The answer replaces the list of ticked activities: each «ثبت شد», or «ثبت نشد» and why. «ارسال
 * دوباره» is offered while something was refused or no answer came; a refusal of the whole
 * submission (a retired equipment, a role that may not record…) is the dialog's alert. «انصراف»
 * goes before an answer, «بستن» after one — never both, and the head has no close button, so «بستن»
 * means an answer is on screen. Every way out (Escape and a click outside included) closes with a
 * `QcSubmissionOutcome`; open it with `disableClose: true`. None closes it while a sending is on its
 * way: its answer would be lost, and with it whether the submission settled.
 */
@Component({
  selector: 'app-qc-submission-dialog',
  imports: [
    DialogHead,
    ErrorBanner,
    FormField,
    Icon,
    MatButton,
    MatDialogActions,
    MatDialogContent,
    MatError,
    MatFormField,
    MatIcon,
    MatInput,
    MatLabel,
    RevealFormErrors,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <app-dialog-head
      [heading]="data.equipment.name"
      subtitle="ثبت انجام فعالیت‌های QC"
      [showClose]="false"
    />

    <form
      [appRevealFormErrors]="trackingForm"
      novalidate
      (submit)="onSubmit(); $event.preventDefault()"
    >
      <mat-dialog-content class="stack">
        @if (resumed && failure() === undefined && results() === undefined) {
          <p class="dialog-notice">
            <mat-icon appIcon="info" />
            <span
              >ارسال قبلی همین ثبت بی‌پاسخ ماند؛ ممکن است برخی فعالیت‌ها ثبت شده باشند. «ثبت» همان
              ثبت را دوباره می‌فرستد و هیچ فعالیتی دو بار ثبت نمی‌شود.</span
            >
          </p>
        }
        @if (failure(); as failed) {
          <app-error-banner
            class="answer-focus"
            tabindex="-1"
            [message]="failed.message"
            [detail]="failed.kind === 'unanswered' ? failed.detail : undefined"
          />
        }

        <mat-form-field appearance="outline">
          <mat-label>شماره ردیابی</mat-label>
          <input
            matInput
            type="text"
            autocomplete="off"
            [formField]="trackingForm.trackingNumber"
          />
          @if (
            trackingForm.trackingNumber().touched() && trackingForm.trackingNumber().errors().length
          ) {
            <mat-error>{{ trackingForm.trackingNumber().errors()[0].message }}</mat-error>
          }
        </mat-form-field>

        <div class="answer" role="status">
          @if (shownResults(); as results) {
            <h3 class="answer__title answer-focus" tabindex="-1">نتیجه ثبت</h3>
            <ul class="activities">
              @for (result of results; track result.activityId) {
                <li class="result activities__item">
                  <span class="activities__name">{{ result.name }}</span>
                  @if (result.recorded) {
                    <span class="outcome outcome--recorded">
                      <mat-icon appIcon="check-circle" />
                      ثبت شد
                    </span>
                  } @else {
                    <span class="outcome outcome--refused">
                      <mat-icon appIcon="block" />
                      ثبت نشد
                    </span>
                    <span class="activities__reason">{{ result.reason }}</span>
                  }
                </li>
              }
            </ul>
          }
        </div>

        @if (shownResults() === undefined) {
          <div class="stack stack--tight">
            <h3 class="answer__title">فعالیت‌های انتخاب‌شده</h3>
            <ul class="activities">
              @for (activity of data.activities; track activity.activityId) {
                <li class="activities__item">
                  <span class="activities__name">{{ activity.activityName }}</span>
                  @if (activity.notes.trim() !== '') {
                    <span class="activities__reason">{{ activity.notes }}</span>
                  }
                </li>
              }
            </ul>
          </div>
        }
      </mat-dialog-content>

      <mat-dialog-actions class="dialog-footer">
        @if (answered()) {
          <button matButton type="button" [disabled]="sending()" (click)="close()">
            <mat-icon appIcon="close" />
            بستن
          </button>
        } @else {
          <button matButton type="button" [disabled]="sending()" (click)="close()">
            <mat-icon appIcon="cancel" />
            انصراف
          </button>
        }
        @if (canResend()) {
          <button matButton="filled" type="button" [disabled]="sending()" (click)="resend()">
            <mat-icon appIcon="retry" />
            ارسال دوباره
          </button>
        } @else if (!answered()) {
          <button matButton="filled" type="submit" [disabled]="sending()">
            <mat-icon appIcon="check" />
            ثبت
          </button>
        }
      </mat-dialog-actions>
    </form>
  `,
  styleUrl: './qc-submission-dialog.scss',
})
export class QcSubmissionDialog {
  protected readonly data = inject<QcSubmissionDialogData>(MAT_DIALOG_DATA);
  private readonly dialogRef =
    inject<MatDialogRef<QcSubmissionDialog, QcSubmissionOutcome>>(MatDialogRef);
  private readonly gateway = inject(QcInspectionsGateway);
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly injector = inject(Injector);

  /** A pending submission reopened: sent before, its answer never came. */
  protected readonly resumed = this.data.submission.trackingNumber !== '';

  private readonly model = signal({ trackingNumber: this.data.submission.trackingNumber });
  /** Set once the submission went out; the API refuses a resend with another tracking number. */
  private readonly locked = signal(this.resumed);
  /** The last sending's answer never came: what it recorded is unknown. */
  private readonly unanswered = signal(this.resumed);
  /** Whether anything went out that may have recorded something. */
  private readonly sent = signal(false);
  protected readonly sending = signal(false);
  protected readonly results = signal<readonly AppQcSubmissionResult[] | undefined>(undefined);
  protected readonly failure = signal<
    Exclude<QcSubmissionFailure, { kind: 'invalid' }> | undefined
  >(undefined);

  protected readonly trackingForm = form(this.model, (path) => {
    required(path.trackingNumber, { message: TRACKING_NUMBER_REQUIRED });
    // Also writes `maxlength` on the input, so it cannot be typed past the API's limit.
    maxLength(path.trackingNumber, TRACKING_NUMBER_MAX_LENGTH, {
      message: TRACKING_NUMBER_TOO_LONG,
    });
    validate(path.trackingNumber, ({ value }) =>
      value() !== '' && value().trim() === ''
        ? { kind: 'required', message: TRACKING_NUMBER_REQUIRED }
        : undefined,
    );
    readonly(path.trackingNumber, () => this.locked());
  });

  protected readonly shownResults = computed<ShownResult[] | undefined>(() =>
    this.results()?.map((result) => {
      const name =
        this.data.activities.find((each) => each.activityId === result.activityId)?.activityName ??
        result.activityName ??
        '';
      return {
        activityId: result.activityId,
        name,
        recorded: result.outcome === 'recorded',
        reason:
          result.outcome === 'recorded'
            ? ''
            : qcRefusalReason(result.problemType, name, this.data.equipment.name),
      };
    }),
  );

  /** An answer is on screen: every activity's outcome, or a refusal of the whole submission. */
  protected readonly answered = computed(
    () => this.results() !== undefined || this.failure()?.kind === 'refused',
  );

  protected readonly canResend = computed(
    () =>
      this.failure()?.kind === 'unanswered' ||
      (this.results()?.some((result) => result.outcome === 'refused') ?? false),
  );

  constructor() {
    const destroyRef = inject(DestroyRef);
    this.dialogRef
      .keydownEvents()
      .pipe(
        filter((event) => event.key === 'Escape' && !this.sending()),
        takeUntilDestroyed(destroyRef),
      )
      .subscribe(() => this.close());
    this.dialogRef
      .backdropClick()
      .pipe(
        filter(() => !this.sending()),
        takeUntilDestroyed(destroyRef),
      )
      .subscribe(() => this.close());
  }

  protected onSubmit(): Promise<boolean> {
    return submit(this.trackingForm, () => this.send());
  }

  protected resend(): void {
    void this.send();
  }

  protected close(): void {
    const sent = this.sent();
    this.dialogRef.close({
      sent,
      recorded: (this.results() ?? [])
        .filter((result) => result.outcome === 'recorded')
        .map((result) => result.activityId),
      settled: (sent || this.resumed) && !this.unanswered(),
      trackingNumber: sent || this.resumed ? this.model().trackingNumber : '',
    });
  }

  private async send(): Promise<ValidationError.WithOptionalFieldTree[] | undefined> {
    const sentBefore = this.sent();
    const trackingNumber = this.model().trackingNumber;
    this.locked.set(true);
    this.sent.set(true);
    this.sending.set(true);
    try {
      const results = await firstValueFrom(
        this.gateway.recordTogether(this.data.equipment.id, {
          submissionId: this.data.submission.submissionId,
          trackingNumber,
          activities: this.data.activities.map(({ activityId, notes }) => ({ activityId, notes })),
        }),
      );
      this.failure.set(undefined);
      this.unanswered.set(false);
      this.results.set(results);
    } catch (error) {
      const failure = qcSubmissionFailureOf(error, {
        equipmentName: this.data.equipment.name,
        trackingNumber,
      });
      if (failure.kind === 'invalid') {
        // Nothing was recorded: the number can be corrected and sent under the same id.
        this.locked.set(false);
        this.sent.set(sentBefore);
        return [
          { fieldTree: this.trackingForm.trackingNumber, kind: 'server', message: failure.message },
        ];
      }
      this.failure.set(failure);
      this.unanswered.set(failure.kind === 'unanswered');
    } finally {
      this.sending.set(false);
    }
    this.focusTheAnswer();
    return undefined;
  }

  /** The button pressed is gone with the answer; focus goes to what replaced it. */
  private focusTheAnswer(): void {
    afterNextRender(
      () => this.host.nativeElement.querySelector<HTMLElement>('.answer-focus')?.focus(),
      { injector: this.injector },
    );
  }
}
