import { d, Interaction, Task, Wait } from '@serenity-js/core';
import { Ensure, equals } from '@serenity-js/assertions';
import {
  LastResponse,
  PatchRequest,
  PostRequest,
  Send,
} from '@serenity-js/rest';
import { Click, isVisible } from '@serenity-js/web';
import { MaintenanceActivitiesPage } from '../ui/maintenance-activities-page';
import { SpecialtyAssignmentDialog } from '../ui/specialty-assignment-dialog';
import {
  EnsureProblemDetail,
  EnsureValidationErrorFor,
} from '../common/problem-detail';
import {
  LocateMaintenanceActivitiesPage,
  LocateTheSpecialtyAssignmentDialog,
  WaitForTheDialogToBeAnswered,
} from './maintenance-pages';
import {
  ActivitySpecialty,
  readMaintenanceActivities,
  specialtyLabels,
  UNSTATED_SPECIALTY,
} from './maintenance-api';
import {
  RegisteredActivity,
  rememberActivity,
  theActivityNamed,
} from './maintenance-records';
import { namedCatalog } from './named-catalog';

/**
 * The maintenance-activity catalog vocabulary — registring-maintenance-activity.feature, and the
 * activities the PM-plan preconditions need. `POST/PATCH maintenance-activities`,
 * `GET maintenance-activities`; the page is `/maintenance-activities`.
 *
 * Every activity has a specialty (issue #108): `POST` and `PATCH` both take `{ name, specialty }`.
 * A step that names none registers the activity as `UNSTATED_SPECIALTY` («مکانیک»), and a rename
 * over the API sends the activity's specialty back unchanged. Activities from before specialties
 * existed are made through the test-only `POST testing/maintenance/legacy-activities`, and given
 * their specialty, all at once, by the system admin (`maintenance-activities/specialty-assignment`).
 */
const catalog = namedCatalog({
  noun: 'maintenance activity',
  resource: 'maintenance-activities',
  page: {
    ...MaintenanceActivitiesPage,
    otherFieldErrors: () => [MaintenanceActivitiesPage.specialtyError()],
  },
  locatePage: LocateMaintenanceActivitiesPage,
  readAll: readMaintenanceActivities,
  remember: rememberActivity,
});

/** Clicks the specialty of the open add/edit dialog. */
const ChooseTheSpecialty = (specialty: ActivitySpecialty): Task =>
  Task.where(
    d`#actor chooses the specialty ${specialtyLabels[specialty]}`,
    Click.on(
      MaintenanceActivitiesPage.specialtyOption(specialtyLabels[specialty]),
    ),
  );

/** The specialty a rename leaves as it is — the one the suite knows the activity has. */
const unchangedSpecialtyOf = (
  activity: RegisteredActivity,
): ActivitySpecialty => activity.specialty ?? UNSTATED_SPECIALTY;

export const RegisterMaintenanceActivity = {
  /** Through the list page's add dialog: the name, then the specialty. */
  using: (name: string, specialty: ActivitySpecialty): Task =>
    catalog.Register.using(name, ChooseTheSpecialty(specialty)),

  /**
   * The add dialog with a name and **no** specialty chosen, submitted — «… بدون تخصص ثبت می کند».
   * The dialog is expected to refuse it.
   */
  withoutASpecialtyUsing: (name: string): Task => catalog.Register.using(name),

  /** `POST maintenance-activities` — the «تلاش …» attempts. */
  viaApiUsing: (
    name: string,
    specialty: ActivitySpecialty = UNSTATED_SPECIALTY,
  ): Task => catalog.Register.viaApiUsing(name, { specialty }),

  /**
   * «… با هر دو تخصص برق و مکانیک ثبت می کند» — a choice the dialog's radio group cannot even
   * express, so it is asked of the API: one `specialty` field holding both.
   */
  withBothSpecialtiesViaApiUsing: (name: string): Task =>
    catalog.Register.viaApiUsing(name, {
      specialty: ['electrical', 'mechanical'],
    }),
};

/** A passive precondition, with the specialty the step names or the unstated default. */
export const RegisterMaintenanceActivityUnlessRegistered = (
  name: string,
  specialty: ActivitySpecialty = UNSTATED_SPECIALTY,
): Interaction => catalog.RegisterUnlessRegistered(name, { specialty });

export const RenameMaintenanceActivity = {
  /** Through the row's edit button and the same dialog; the specialty stays as it is shown. */
  using: catalog.Rename.using,

  /** `PATCH maintenance-activities/:id` `{ name, specialty }` — the specialty sent back unchanged. */
  viaApiUsing: (activity: RegisteredActivity, newName: string): Task =>
    catalog.Rename.viaApiUsing(activity, newName, {
      specialty: unchangedSpecialtyOf(activity),
    }),
};

/**
 * Issue #110: the System Admin's rename of an activity in a plan or a history — the edit dialog's
 * name only (the specialty left as shown, since changing it would still be refused), confirmed.
 */
export const CorrectMaintenanceActivityName = catalog.Correct;

export const ChangeMaintenanceActivitySpecialty = {
  /** Through the row's edit button: the other specialty, submitted with the name as it is. */
  using: (name: string, specialty: ActivitySpecialty): Task =>
    Task.where(
      d`#actor changes the specialty of ${name} to ${specialtyLabels[specialty]}`,
      catalog.OpenTheEditForm(name),
      ChooseTheSpecialty(specialty),
      catalog.SubmitTheForm(),
    ),

  /** `PATCH maintenance-activities/:id` `{ name, specialty }` — the name sent back unchanged. */
  viaApiUsing: (
    activity: RegisteredActivity,
    specialty: ActivitySpecialty,
  ): Task =>
    Task.where(
      d`#actor changes the specialty of ${activity.name} to ${specialtyLabels[specialty]} (via API)`,
      Send.a(
        PatchRequest.to(`maintenance-activities/${activity.id}`).with({
          name: activity.name,
          specialty,
        }),
      ),
    ),
};

export const EnterNewMaintenanceActivityDetails = (name: string): Task =>
  catalog.EnterNewDetails(name, ChooseTheSpecialty(UNSTATED_SPECIALTY));
export const SubmitMaintenanceActivityLeavingTheNameEmpty =
  catalog.SubmitLeavingTheNameEmpty;
export const NoteTheMaintenanceActivitiesBeforeTheAttempt =
  catalog.NoteTheRecordsBeforeTheAttempt;
export const rememberTheMaintenanceActivityRenameTarget =
  catalog.rememberTheRenameTarget;
export const EnsureMaintenanceActivityIsRegistered = catalog.EnsureRegistered;
export const EnsureNoNewMaintenanceActivityWasRegistered =
  catalog.EnsureNothingNewRegistered;
export const EnsureMaintenanceActivityWasNotRenamed = catalog.EnsureNotRenamed;

export const EnsureMaintenanceActivityNameErrorShown = (): Task =>
  catalog.EnsureNameErrorShown('missing');

export const EnsureDuplicateMaintenanceActivityNameErrorShown = (): Task =>
  catalog.EnsureNameErrorShown('duplicate');

/**
 * «فعالیت «…» با تخصص «…» در سیستم ثبت شده باشد / باقی مانده باشد» and «… همچنان تخصصی نداشته
 * باشد» — exactly one activity of that name, with that specialty (`null`: none).
 */
export const EnsureMaintenanceActivitySpecialty = (
  name: string,
  specialty: ActivitySpecialty | null,
): Interaction =>
  Interaction.where(
    d`#actor ensures the maintenance activity ${name} has the specialty ${specialty ?? 'none'}`,
    async (actor) => {
      const specialties = (await readMaintenanceActivities(actor))
        .filter((activity) => activity.name === name)
        .map((activity) => activity.specialty);
      await Ensure.that(specialties, equals([specialty])).performAs(actor);
    },
  );

/**
 * How the last «… فعالیت جدیدی … <تخصص> ثبت می کند» was made: through the dialog («بدون تخصص» —
 * the visitor leaves the choice empty) or the API («با هر دو تخصص» — the radio group cannot hold
 * two). Set by both owning steps, so no scenario inherits another's; it tells the readings of
 * «پیغام خطای تخصص فعالیت نشان داده شود» apart.
 */
export type SpecialtyAttemptDoor = 'browser' | 'api';

let specialtyAttemptDoor: SpecialtyAttemptDoor = 'browser';

export const attemptedTheSpecialtyThrough = (
  door: SpecialtyAttemptDoor,
): void => {
  specialtyAttemptDoor = door;
};

/**
 * «پیغام خطای تخصص فعالیت نشان داده شود» — after the dialog, its specialty error is on screen;
 * after the API, a 400 `validation-error` naming `specialty`.
 */
export const EnsureSpecialtyErrorShown = (): Task =>
  specialtyAttemptDoor === 'browser'
    ? Task.where(
        '#actor ensures the activity dialog shows the specialty error',
        Wait.until(MaintenanceActivitiesPage.specialtyError(), isVisible()),
      )
    : Task.where(
        '#actor ensures the specialty was refused',
        EnsureValidationErrorFor('specialty'),
      );

// --- Activities from before specialties existed (issue #108) ------------------------------------

/**
 * «فعالیت «…» پیش از تعیین تخصص ثبت شده باشد و تخصصی نداشته باشد» — the test stack's
 * `POST testing/maintenance/legacy-activities` `{ name }` → 201 `{ id }`, the only way to make an
 * activity with no specialty on a fresh database. Remembered with `specialty: null`.
 */
export const RegisterLegacyMaintenanceActivity = (name: string): Interaction =>
  Interaction.where(
    d`#actor has registered ${name} before specialties existed`,
    async (actor) => {
      await Send.a(
        PostRequest.to('testing/maintenance/legacy-activities').with({ name }),
      ).performAs(actor);
      await Ensure.that(LastResponse.status(), equals(201)).performAs(actor);
      const { id } = await actor.answer(LastResponse.body<{ id: string }>());
      rememberActivity({ id, name, specialty: null });
    },
  );

/** One line of the system admin's assignment — an activity, by name, and its specialty. */
export interface SpecialtyAssignment {
  activityName: string;
  specialty: ActivitySpecialty;
}

const assignmentRequest = (assignments: SpecialtyAssignment[]) =>
  PostRequest.to('maintenance-activities/specialty-assignment').with({
    assignments: assignments.map(({ activityName, specialty }) => ({
      activityId: theActivityNamed(activityName).id,
      specialty,
    })),
  });

export const AssignLegacySpecialties = {
  /**
   * Through the modal that opens for the system admin after signing in: each activity's specialty,
   * then «ثبت تخصص ها». Done once the modal has closed — or has said what was wrong.
   */
  using: (assignments: SpecialtyAssignment[]): Task =>
    Task.where(
      d`#actor assigns the specialties of earlier activities: ${assignments}`,
      LocateTheSpecialtyAssignmentDialog(),
      ...assignments.map(({ activityName, specialty }) =>
        Click.on(
          SpecialtyAssignmentDialog.specialtyOf(
            activityName,
            specialtyLabels[specialty],
          ),
        ),
      ),
      Click.on(SpecialtyAssignmentDialog.submitButton()),
      WaitForTheDialogToBeAnswered(
        SpecialtyAssignmentDialog.heading(),
        SpecialtyAssignmentDialog.alert(),
      ),
    ),

  /**
   * `POST maintenance-activities/specialty-assignment` — the «تلاش …» attempts, and the partial
   * assignment the modal would not even submit (its button waits for every choice), which is the
   * backend's all-or-nothing rule to refuse.
   */
  viaApiUsing: (assignments: SpecialtyAssignment[]): Task =>
    Task.where(
      d`#actor assigns the specialties of earlier activities: ${assignments} (via API)`,
      Send.a(assignmentRequest(assignments)),
    ),

  /** A passive precondition — accepted. */
  asAPrecondition: (assignments: SpecialtyAssignment[]): Task =>
    Task.where(
      d`#actor has assigned the specialties of earlier activities: ${assignments}`,
      Send.a(assignmentRequest(assignments)),
      Ensure.that(LastResponse.status(), equals(204)),
    ),
};

/** «پیغام خطای تعیین نشدن تخصص همه فعالیت ها نشان داده شود» — 400 `specialty-assignment-incomplete`. */
export const EnsureToldEveryActivityNeedsASpecialty = (): Task =>
  Task.where(
    '#actor ensures they were told every earlier activity needs a specialty',
    EnsureProblemDetail(400, 'specialty-assignment-incomplete'),
  );
