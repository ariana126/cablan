import { randomUUID } from 'node:crypto';
import {
  Activity,
  actorCalled,
  d,
  Interaction,
  notes,
  Question,
  Task,
} from '@serenity-js/core';
import { Ensure, equals, isPresent, isTrue } from '@serenity-js/assertions';
import { LastResponse, PostRequest, Send } from '@serenity-js/rest';
import { Click, Enter, isVisible } from '@serenity-js/web';
import { LetItBeNow } from '../common/clock';
import { isGone } from '../common/is-gone';
import { LogInAsPersona } from '../common/personas';
import { POLLING_INTERVAL_MS, WaitUntil } from '../common/polling';
import { EnsureValidationErrorFor } from '../common/problem-detail';
import { keepingTheSpotlight } from '../common/spotlight';
import {
  asTheSystemAdmin,
  theEquipmentNamed,
} from '../maintenance-management/maintenance-records';
import {
  QcRecordingDialog,
  QcSubmissionDialog,
} from '../ui/qc-inspection-page';
import {
  QcInstant,
  QcSubmissionReadModel,
  QcSubmissionResultReadModel,
} from './qc-api';
import { AssignQcActivity, UnassignQcActivity } from './qc-assignment';
import { ScanTheQr } from './qc-inspection';
import { theQcActivityNamed } from './qc-records';

/**
 * Several QC activities of one equipment recorded in one submission, with one tracking number
 * (issue #132) — recording-qc-execution.feature's last four rules. `POST qc-equipment/
 * :equipmentId/executions` `{ submissionId, trackingNumber, activities: [{ activityId, notes? }] }`
 * makes one independent record per activity and answers 200 `{ results }`, each activity
 * `recorded` or `refused` on its own (`qc-api.ts#QcSubmissionReadModel`). The `submissionId` is
 * the client's, drawn once per submission and sent again on a resend, which then never makes a
 * second record of an activity it already recorded. Equipment-wide refusals: 400
 * `validation-error` (`trackingNumber`, `activities`, `submissionId`), 403, 404
 * `equipment-not-found`, 409 `equipment-retired`.
 *
 * Doors: the plain «… با هم ثبت می کند» is the inspector scanning the equipment's QR on
 * `/qc-inspection` (recording starts from a scan only — the list itself offers no way to record),
 * ticking the activities in the recording dialog the scan opens and pressing «ثبت انجام»
 * (`ui/qc-inspection-page.ts`, locators `ASSUMPTION`s). Every
 * «تلاش …» attempt, both resends (a lost answer can't be staged in a browser) and every
 * precondition go through the API. Facts are the record steps' own (`qc-execution.ts`).
 */

/** One activity ticked in a submission, with the notes written beside it (none when absent). */
export interface QcChosenActivity {
  activityName: string;
  notes?: string;
}

/** The body as it went over the wire — kept whole, so a resend sends exactly the same thing. */
interface QcSubmissionBody {
  submissionId: string;
  trackingNumber?: string;
  activities: Array<{ activityId: string; notes?: string }>;
}

interface QcSubmission {
  resource: string;
  body: QcSubmissionBody;
}

interface QcSubmissionNotes {
  lastQcSubmission: QcSubmission;
  /** What the first sending of that submission made of each activity, as the system answered. */
  firstSendingResults: QcSubmissionResultReadModel[];
}

const submissionResourceOf = (equipmentName: string): string =>
  `qc-equipment/${theEquipmentNamed(equipmentName).id}/executions`;

/** A fresh submission: a new `submissionId`, the activities by id in the order they were ticked. */
const aNewSubmission = (
  equipmentName: string,
  trackingNumber: string | undefined,
  activities: QcChosenActivity[],
): QcSubmission => ({
  resource: submissionResourceOf(equipmentName),
  body: {
    submissionId: randomUUID(),
    ...(trackingNumber === undefined ? {} : { trackingNumber }),
    activities: activities.map(({ activityName, notes: text }) => ({
      activityId: theQcActivityNamed(activityName).id,
      ...(text === undefined ? {} : { notes: text }),
    })),
  },
});

/** Sends a submission and notes it on the actor's notepad. The response is left as it came. */
const Submit = (submission: QcSubmission): Task =>
  Task.where(
    d`#actor submits ${submission.body} (via API)`,
    notes<QcSubmissionNotes>().set('lastQcSubmission', submission),
    Send.a(PostRequest.to(submission.resource).with(submission.body)),
  );

/**
 * The browser's answer to «ثبت»: the submission dialog closes by itself (its tracking number field
 * is gone; the recording dialog beneath stays), or it shows the per-activity result with «بستن»,
 * which is pressed. Throws when neither comes within 5 s, so no following step judges a submission
 * whose answer never came.
 */
const WaitForTheSubmissionToBeAnswered = (): Interaction =>
  Interaction.where(
    '#actor waits for the QC submission to be answered',
    async (actor) => {
      const deadline = Date.now() + 5_000;
      do {
        const close = await actor.answer(QcSubmissionDialog.closeButton());
        if (await close.isPresent()) {
          await WaitUntil(
            QcSubmissionDialog.closeButton(),
            isVisible(),
          ).performAs(actor);
          await Click.on(QcSubmissionDialog.closeButton()).performAs(actor);
          await WaitUntil(QcSubmissionDialog.closeButton(), isGone()).performAs(
            actor,
          );
          return;
        }
        const field = await actor.answer(
          QcSubmissionDialog.trackingNumberField(),
        );
        if (!(await field.isPresent())) {
          return;
        }
        await new Promise((resolve) =>
          setTimeout(resolve, POLLING_INTERVAL_MS),
        );
      } while (Date.now() < deadline);
      throw new Error(
        'The QC submission dialog was not answered within 5 s: it is still open and shows no result.',
      );
    },
  );

/**
 * Ticks one activity in the equipment's recording dialog and, if it has any, writes its notes. Fields are
 * waited for as *present*: an empty, unfocused Material field never passes `isVisible`'s hit-test
 * (`acceptance-tests/CLAUDE.md`, "Waiting"), and `Enter` / `Click` scroll and check the rest.
 */
const TickTheActivity = (
  equipmentName: string,
  { activityName, notes: text }: QcChosenActivity,
): Activity[] => [
  Click.on(QcRecordingDialog.activityCheckbox(equipmentName, activityName)),
  ...(text === undefined
    ? []
    : [
        WaitUntil(
          QcRecordingDialog.activityNotesField(equipmentName, activityName),
          isPresent(),
        ),
        Enter.theValue(text).into(
          QcRecordingDialog.activityNotesField(equipmentName, activityName),
        ),
      ]),
];

export const RecordQcExecutionsTogether = {
  /**
   * «… انجام فعالیت های زیر / «…» و «…» روی «…» را با شماره ردیابی «…» با هم ثبت می کند» — on
   * `/qc-inspection`: scan the equipment's QR, tick each activity in the recording dialog the scan
   * opens (notes beside it), «ثبت انجام», the tracking number in the submission dialog, «ثبت»,
   * wait for the answer, and leave the recording dialog with «پایان».
   */
  using: (
    equipmentName: string,
    trackingNumber: string,
    activities: QcChosenActivity[],
  ): Task =>
    Task.where(
      d`#actor records ${activities.map((a) => a.activityName)} on ${equipmentName} together with tracking number ${trackingNumber}`,
      ScanTheQr.using(equipmentName),
      WaitUntil(QcRecordingDialog.recordButton(equipmentName), isPresent()),
      ...activities.flatMap((activity) =>
        TickTheActivity(equipmentName, activity),
      ),
      Click.on(QcRecordingDialog.recordButton(equipmentName)),
      WaitUntil(QcSubmissionDialog.trackingNumberField(), isPresent()),
      Enter.theValue(trackingNumber).into(
        QcSubmissionDialog.trackingNumberField(),
      ),
      Click.on(QcSubmissionDialog.submitButton()),
      WaitForTheSubmissionToBeAnswered(),
      Click.on(QcRecordingDialog.finishButton(equipmentName)),
      WaitUntil(QcRecordingDialog.dialogOf(equipmentName), isGone()),
    ),

  /**
   * A new submission over HTTP — no `trackingNumber` at all when it is `undefined` («بدون شماره
   * ردیابی»). Noted for «همان ثبت را دوباره می فرستد»; the response is left for the step that
   * judges it.
   */
  viaApiUsing: (
    equipmentName: string,
    trackingNumber: string | undefined,
    activities: QcChosenActivity[],
  ): Task =>
    Task.where(
      d`#actor records ${activities.map((a) => a.activityName)} on ${equipmentName} together with tracking number ${trackingNumber} (via API)`,
      Submit(aNewSubmission(equipmentName, trackingNumber, activities)),
    ),
};

/**
 * Notes what the first sending of the submission made of each activity, so a resend can be held to
 * it (`ResendTheQcSubmission`). Read off the response the precondition has already checked.
 */
const NoteWhatTheFirstSendingRecorded = (): Interaction =>
  Interaction.where(
    '#actor notes what the first sending of the QC submission recorded',
    async (actor) => {
      const { results } = await actor.answer(
        LastResponse.body<QcSubmissionReadModel>(),
      );
      await notes<QcSubmissionNotes>()
        .set('firstSendingResults', results)
        .performAs(actor);
    },
  );

/**
 * The resend's own answer: 200, every activity now `recorded`, and each activity the first sending
 * had recorded reported with **that** record's `executionId` — found, not made again — while an
 * activity it had refused has a record of its own now, different from every earlier one. Without
 * this a refused or failed resend (409, 500) would still leave the record counts the `Then`s read.
 */
const EnsureTheResendKeptWhatWasAlreadyRecorded = (): Interaction =>
  Interaction.where(
    '#actor ensures the resend recorded every activity without recording any twice',
    async (actor) => {
      await Ensure.that(LastResponse.status(), equals(200)).performAs(actor);
      const first = await actor.answer(
        notes<QcSubmissionNotes>().get('firstSendingResults'),
      );
      const { results } = await actor.answer(
        LastResponse.body<QcSubmissionReadModel>(),
      );
      const earlierIds = first
        .map((result) => result.executionId)
        .filter((id): id is string => id !== null);
      await Ensure.that(
        results.map(({ activityId, outcome }) => ({ activityId, outcome })),
        equals(
          first.map(({ activityId }) => ({ activityId, outcome: 'recorded' })),
        ),
      ).performAs(actor);
      for (const [index, result] of results.entries()) {
        const earlier = first[index]?.executionId ?? null;
        if (earlier === null) {
          await Ensure.that(
            result.executionId !== null &&
              !earlierIds.includes(result.executionId),
            isTrue(),
          ).performAs(actor);
        } else {
          await Ensure.that(result.executionId, equals(earlier)).performAs(
            actor,
          );
        }
      }
    },
  );

export const ResendTheQcSubmission = {
  /**
   * «… همان ثبت را دوباره می فرستد» — the noted submission, unchanged, same `submissionId`, and
   * its answer held to the first sending's (`EnsureTheResendKeptWhatWasAlreadyRecorded`).
   */
  viaApi: (): Task =>
    Task.where(
      '#actor resends the same QC submission (via API)',
      Send.a(
        PostRequest.to(
          notes<QcSubmissionNotes>()
            .get('lastQcSubmission')
            .as((submission) => submission.resource),
        ).with(
          notes<QcSubmissionNotes>()
            .get('lastQcSubmission')
            .as((submission) => submission.body),
        ),
      ),
      EnsureTheResendKeptWhatWasAlreadyRecorded(),
    ),
};

// ---------------------------------------------------------------------------------------------
// What the inspector is told — the attempt's own response

/** «به او گفته شود که دست کم یک فعالیت باید انتخاب شود» — 400 `validation-error` on `activities`. */
export const EnsureToldAnActivityMustBeChosen = (): Task =>
  Task.where(
    '#actor ensures they were told to choose at least one activity',
    EnsureValidationErrorFor('activities'),
  );

/** `qc-activity-not-assigned`, whether the backend writes the slug or its full type URI. */
const slugOf = (problemType: string | null): string | null =>
  problemType === null ? null : (problemType.split('/').pop() ?? null);

interface ReportedOutcome {
  activityName: string | null;
  outcome: string;
  problemType: string | null;
}

const TheReportedOutcomes = () =>
  Question.about<ReportedOutcome[]>(
    'the outcome reported for each activity',
    async (actor) =>
      (
        await actor.answer(LastResponse.body<QcSubmissionReadModel>())
      ).results.map(({ activityName, outcome, problemType }) => ({
        activityName,
        outcome,
        problemType: slugOf(problemType),
      })),
  );

const recordedOutcome = (activityName: string): ReportedOutcome => ({
  activityName,
  outcome: 'recorded',
  problemType: null,
});

const refusedAsNotAssigned = (activityName: string): ReportedOutcome => ({
  activityName,
  outcome: 'refused',
  problemType: 'qc-activity-not-assigned',
});

/**
 * «به او گفته شود که «A» ثبت شد و «B» ثبت نشد چون «B» به «E» تخصیص داده نشده است» — a 200 whose
 * results, in the submitted order, report A recorded and B refused as not assigned.
 */
export const EnsureToldTheOutcomeOfEachActivity = (
  recorded: string,
  refused: string,
  equipmentName: string,
): Task =>
  Task.where(
    d`#actor ensures they were told ${recorded} was recorded and ${refused} was not, as it is not assigned to ${equipmentName}`,
    Ensure.that(LastResponse.status(), equals(200)),
    Ensure.that(
      TheReportedOutcomes(),
      equals([recordedOutcome(recorded), refusedAsNotAssigned(refused)]),
    ),
  );

// ---------------------------------------------------------------------------------------------
// Preconditions — over the API

export interface PreconditionSubmission {
  /** Tehran wall-clock minute to submit at; now, when absent. */
  at?: QcInstant;
  /** The activities expected to be refused as not assigned; every other one recorded. */
  refused?: string[];
}

/**
 * «نیکروش انجام «A» و «B» روی «…» را (در «…» ساعت «…») با شماره ردیابی «…» با هم ثبت کرده باشد
 * (اما نتیجه آن به او نرسیده باشد)» — the persona sends a new submission (the clock moved to its
 * minute first, then logged in on it) and it is noted on their notepad for a later resend. That
 * the persona never read the answer changes nothing for the system; the suite still checks it, or
 * a submission that silently failed would let the resend make the records and the scenario pass
 * without proving anything. What it recorded is noted too, for the resend to be held to. Activities
 * not refused are first assigned unless they are, as `qc-execution.ts#recordedAsAPrecondition`
 * does — a record implies the assignment. The spotlight stays where it was.
 */
export const submittedTogetherAsAPrecondition = async (
  personaName: string,
  equipmentName: string,
  trackingNumber: string,
  activityNames: string[],
  { at, refused = [] }: PreconditionSubmission = {},
): Promise<void> => {
  const recordable = activityNames.filter((name) => !refused.includes(name));
  await asTheSystemAdmin(
    ...recordable.map((name) =>
      AssignQcActivity.unlessAssigned(name, equipmentName),
    ),
  );
  await keepingTheSpotlight(() =>
    actorCalled(personaName).attemptsTo(
      ...(at ? [LetItBeNow(at.date, at.time)] : []),
      LogInAsPersona(personaName),
      RecordQcExecutionsTogether.viaApiUsing(
        equipmentName,
        trackingNumber,
        activityNames.map((activityName) => ({ activityName })),
      ),
      Ensure.that(LastResponse.status(), equals(200)),
      Ensure.that(
        TheReportedOutcomes(),
        equals(
          activityNames.map((name) =>
            refused.includes(name)
              ? refusedAsNotAssigned(name)
              : recordedOutcome(name),
          ),
        ),
      ),
      NoteWhatTheFirstSendingRecorded(),
    ),
  );
};

/**
 * «… با هم ثبت کرده باشد و فقط «A» ثبت شده باشد» — a submission only partly made: the System Admin
 * unassigns every other activity, the persona submits them all (noted, A recorded, the rest
 * refused), and the System Admin assigns them back, so a resend can now record them.
 */
export const partlySubmittedTogetherAsAPrecondition = async (
  personaName: string,
  equipmentName: string,
  trackingNumber: string,
  activityNames: string[],
  onlyRecorded: string,
): Promise<void> => {
  const leftOut = activityNames.filter((name) => name !== onlyRecorded);
  await asTheSystemAdmin(
    ...leftOut.map((name) =>
      UnassignQcActivity.unlessUnassigned(name, equipmentName),
    ),
  );
  await submittedTogetherAsAPrecondition(
    personaName,
    equipmentName,
    trackingNumber,
    activityNames,
    { refused: leftOut },
  );
  await asTheSystemAdmin(
    ...leftOut.map((name) =>
      AssignQcActivity.unlessAssigned(name, equipmentName),
    ),
  );
};

/** The Gherkin's activity table: «فعالیت», and «توضیحات» where «-» means none. */
export const chosenActivitiesFrom = (
  rows: Record<string, string>[],
): QcChosenActivity[] =>
  rows.map((row) => {
    const text = (row['توضیحات'] ?? '-').trim();
    return {
      activityName: (row['فعالیت'] ?? '').trim(),
      ...(text === '-' || text === '' ? {} : { notes: text }),
    };
  });
