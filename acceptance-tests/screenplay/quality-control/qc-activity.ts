import { d, Interaction, Question, Task } from '@serenity-js/core';
import { WaitUntil } from '../common/polling';
import { Ensure, equals, isPresent } from '@serenity-js/assertions';
import {
  DeleteRequest,
  LastResponse,
  PatchRequest,
  PostRequest,
  Send,
} from '@serenity-js/rest';
import { Click, Enter, isVisible } from '@serenity-js/web';
import { QcActivitiesPage } from '../ui/qc-activities-page';
import { EnsureProblemDetail } from '../common/problem-detail';
import { withTheCorrectionApplied } from '../common/correction-confirmation';
import { WaitForTheDialogToBeAnswered } from '../maintenance-management/maintenance-pages';
import { QcActivityReadModel, readQcActivities } from './qc-api';
import { LocateQcActivitiesPage } from './qc-pages';
import { rememberQcActivity, theQcActivityNamed } from './qc-records';

/**
 * The QC activity catalog — registring-qc-activity.feature, and every QC feature's «فعالیت QC …
 * تعریف شده باشد». `POST/PATCH/DELETE qc-activities[/:id]`, `GET qc-activities` (by name, with
 * `assignedEquipmentCount`); the page is `/qc-activities`.
 *
 * Doors: every define, rename, correction and deletion goes through the API, as the dispatch for
 * issue #119 asked («prefer HTTP where the voice allows»); only «اطلاعات فعالیت QC جدید را وارد می
 * کند» + «اما عنوان فعالیت را خالی می گذارد» drive the define dialog — that voice is about the
 * form, and its «پیغام خطای عنوان …» is what the dialog shows. Facts are read over the API.
 */

/** A name no scenario uses — for the «تلاش …» attempts, whose Gherkin names none. */
export const aFreshQcActivityName = (): string => `فعالیت QC تست ${Date.now()}`;

const RememberTheDefinedActivity = (name: string): Interaction =>
  Interaction.where(
    d`#actor remembers the QC activity ${name}, if it was defined`,
    async (actor) => {
      if ((await actor.answer(LastResponse.status())) !== 201) {
        return;
      }
      const { id } = await actor.answer(LastResponse.body<{ id: string }>());
      rememberQcActivity({ id, name });
    },
  );

export const DefineQcActivity = {
  /** `POST qc-activities` — the response is left for the step that judges it. */
  viaApiUsing: (name: string): Task =>
    Task.where(
      d`#actor defines the QC activity ${name} (via API)`,
      Send.a(PostRequest.to('qc-activities').with({ name })),
      RememberTheDefinedActivity(name),
    ),
};

/**
 * A passive precondition: the activity exists — defined now unless the system already has one by
 * that name, since a background and its scenario may both state it.
 */
export const DefineQcActivityUnlessDefined = (name: string): Interaction =>
  Interaction.where(
    d`#actor makes sure the QC activity ${name} is defined`,
    async (actor) => {
      const existing = (await readQcActivities(actor)).find(
        (activity) => activity.name === name,
      );
      if (existing) {
        rememberQcActivity({ id: existing.id, name: existing.name });
        return;
      }
      await Send.a(PostRequest.to('qc-activities').with({ name })).performAs(
        actor,
      );
      await Ensure.that(LastResponse.status(), equals(201)).performAs(actor);
      await RememberTheDefinedActivity(name).performAs(actor);
    },
  );

const theActivityResource = (name: string) =>
  Question.about(
    d`the QC activity ${name}`,
    () => `qc-activities/${theQcActivityNamed(name).id}`,
  );

export const RenameQcActivity = {
  /** `PATCH qc-activities/:id` — the response is left for the step that judges it. */
  viaApiUsing: (name: string, newName: string): Task =>
    Task.where(
      d`#actor renames the QC activity ${name} to ${newName} (via API)`,
      Send.a(
        PatchRequest.to(theActivityResource(name)).with({ name: newName }),
      ),
    ),
};

/**
 * Issue #110's System Admin exception, granted to QC activities by issue #119: «… عنوان … را به …
 * تغییر می دهد و اعمال آن در اطلاعات و سوابق مرتبط را تایید می کند» — the rename sent with
 * `applyToRelatedRecords: true`, which is the confirmation over HTTP.
 */
export const CorrectQcActivityName = {
  viaApiUsing: (name: string, newName: string): Task =>
    Task.where(
      d`#actor corrects the name of the QC activity ${name} to ${newName} (via API)`,
      Send.a(
        PatchRequest.to(theActivityResource(name)).with(
          withTheCorrectionApplied({ name: newName }),
        ),
      ),
    ),
};

export const DeleteQcActivity = {
  /** `DELETE qc-activities/:id` — the response is left for the step that judges it. */
  viaApiUsing: (name: string): Task =>
    Task.where(
      d`#actor deletes the QC activity ${name} (via API)`,
      Send.a(DeleteRequest.to(theActivityResource(name))),
    ),
};

// ---------------------------------------------------------------------------------------------
// The define dialog

/** «… اطلاعات فعالیت QC جدید را وارد می کند» — opens the define dialog and types a name, unsubmitted. */
export const EnterNewQcActivityDetails = (name: string): Task =>
  Task.where(
    d`#actor enters the details of a new QC activity`,
    LocateQcActivitiesPage(),
    Click.on(QcActivitiesPage.addButton()),
    WaitUntil(QcActivitiesPage.nameField(), isPresent()),
    Enter.theValue(name).into(QcActivitiesPage.nameField()),
  );

/** «اما عنوان فعالیت را خالی می گذارد» — empties the open define dialog's name and submits it. */
export const SubmitTheQcActivityLeavingTheNameEmpty = (): Task =>
  Task.where(
    '#actor submits the new QC activity form leaving the name empty',
    Enter.theValue('').into(QcActivitiesPage.nameField()),
    Click.on(QcActivitiesPage.registerButton()),
    WaitForTheDialogToBeAnswered(
      QcActivitiesPage.dialog(),
      QcActivitiesPage.nameError(),
    ),
  );

/** «پیغام خطای عنوان فعالیت QC نشان داده شود» — the dialog's name field says what's wrong. */
export const EnsureQcActivityNameErrorShown = (): Task =>
  Task.where(
    '#actor ensures the QC activity form shows the name error',
    WaitUntil(QcActivitiesPage.nameError(), isVisible()),
  );

// ---------------------------------------------------------------------------------------------
// Refusals — the attempt's own response

/** «پیغام خطای تکراری بودن عنوان فعالیت QC نشان داده شود» — 409 `qc-activity-name-taken`. */
export const EnsureToldTheQcActivityNameIsTaken = (): Task =>
  Task.where(
    '#actor ensures they were told the QC activity name is taken',
    EnsureProblemDetail(409, 'qc-activity-name-taken'),
  );

// ---------------------------------------------------------------------------------------------
// Facts — over the API

type ActivitySnapshot = Pick<QcActivityReadModel, 'id' | 'name'>[];

/** The catalog before an attempt, so «… ثبت نشده / ویرایش نشده باشد» can compare with it. */
let activitiesBeforeTheAttempt: ActivitySnapshot | undefined;

const snapshotOf = (activities: QcActivityReadModel[]): ActivitySnapshot =>
  activities
    .map(({ id, name }) => ({ id, name }))
    .sort((a, b) => a.id.localeCompare(b.id));

export const forgetTheNotedQcActivities = (): void => {
  activitiesBeforeTheAttempt = undefined;
};

export const NoteTheQcActivitiesBeforeTheAttempt = (): Interaction =>
  Interaction.where('#actor notes the QC activity catalog', async (actor) => {
    activitiesBeforeTheAttempt = snapshotOf(await readQcActivities(actor));
  });

/**
 * «فعالیت QC جدیدی ثبت نشده باشد», «فعالیت QC ویرایش نشده باشد» — the catalog is exactly what was
 * noted before the attempt: no activity added, none renamed or removed.
 */
export const EnsureTheQcActivitiesAreAsBefore = (): Interaction =>
  Interaction.where(
    '#actor ensures the QC activity catalog is as it was before the attempt',
    async (actor) => {
      if (!activitiesBeforeTheAttempt) {
        throw new Error(
          'The QC activities were not noted before the attempt this step judges.',
        );
      }
      await Ensure.that(
        snapshotOf(await readQcActivities(actor)),
        equals(activitiesBeforeTheAttempt),
      ).performAs(actor);
    },
  );

/**
 * «فعالیت QC «…» بدون تغییر در سیستم باقی مانده باشد» — the activity is still there under its name,
 * and nothing in the catalog changed since the attempt was noted.
 */
export const EnsureTheQcActivityIsUnchanged = (name: string): Task =>
  Task.where(
    d`#actor ensures the QC activity ${name} is unchanged`,
    EnsureQcActivityIsDefined(name),
    EnsureTheQcActivitiesAreAsBefore(),
  );

/** «فعالیت QC «…» (همچنان) در سیستم ثبت شده باشد» — exactly one activity of that name. */
export const EnsureQcActivityIsDefined = (name: string): Interaction =>
  Interaction.where(
    d`#actor ensures the QC activity ${name} is defined`,
    async (actor) => {
      const named = (await readQcActivities(actor)).filter(
        (activity) => activity.name === name,
      );
      await Ensure.that(named.length, equals(1)).performAs(actor);
    },
  );

/** «فعالیت QC «…» در سیستم نباشد». */
export const EnsureQcActivityIsNotDefined = (name: string): Interaction =>
  Interaction.where(
    d`#actor ensures no QC activity is named ${name}`,
    async (actor) => {
      const named = (await readQcActivities(actor)).filter(
        (activity) => activity.name === name,
      );
      await Ensure.that(named, equals([])).performAs(actor);
    },
  );

/** «فعالیت QC «…» به هیچ تجهیزی تخصیص داده نشده باشد». */
export const EnsureQcActivityIsAssignedToNoEquipment = (
  name: string,
): Interaction =>
  Interaction.where(
    d`#actor ensures the QC activity ${name} is assigned to no equipment`,
    async (actor) => {
      const activity = (await readQcActivities(actor)).find(
        (candidate) => candidate.name === name,
      );
      await Ensure.that(activity?.assignedEquipmentCount, equals(0)).performAs(
        actor,
      );
    },
  );
