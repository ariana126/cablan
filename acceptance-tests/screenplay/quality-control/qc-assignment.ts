import { d, Interaction, Question, Task } from '@serenity-js/core';
import { Ensure, equals } from '@serenity-js/assertions';
import {
  DeleteRequest,
  GetRequest,
  LastResponse,
  PostRequest,
  Send,
} from '@serenity-js/rest';
import { EnsureProblemDetail } from '../common/problem-detail';
import { theEquipmentNamed } from '../maintenance-management/maintenance-records';
import { QcEquipmentReadModel, readQcEquipment } from './qc-api';
import { theEquipmentIdNamed, theQcActivityNamed } from './qc-records';

/**
 * Assigning QC activities to equipment — assigning-qc-activity.feature, and every QC feature's
 * «فعالیت QC … به تجهیز … تخصیص داده شده باشد». `POST qc-equipment/:equipmentId/activities`
 * `{ activityId }` (201; 409 `qc-activity-already-assigned`, 409 `equipment-retired`) and
 * `DELETE qc-equipment/:equipmentId/activities/:activityId` (204; 404 `qc-activity-not-assigned`).
 * Only Management and the System Admin may; anyone else gets 403.
 *
 * Doors: the API throughout, as the dispatch for issue #119 asked — who may assign, the duplicate
 * and the retired-equipment refusals and what an unassignment keeps are backend rules. Facts read
 * `GET qc-equipment/:equipmentId` by the equipment's current name.
 */

const activitiesResourceOf = (equipmentName: string) =>
  Question.about(
    d`the QC activities of ${equipmentName}`,
    () => `qc-equipment/${theEquipmentNamed(equipmentName).id}/activities`,
  );

const assignmentResourceOf = (activityName: string, equipmentName: string) =>
  Question.about(
    d`the assignment of ${activityName} to ${equipmentName}`,
    () =>
      `qc-equipment/${theEquipmentNamed(equipmentName).id}/activities/${theQcActivityNamed(activityName).id}`,
  );

export const AssignQcActivity = {
  /** The response is left for the step that judges it. */
  viaApiUsing: (activityName: string, equipmentName: string): Task =>
    Task.where(
      d`#actor assigns the QC activity ${activityName} to ${equipmentName} (via API)`,
      Send.a(
        PostRequest.to(activitiesResourceOf(equipmentName)).with(
          Question.about(d`the QC activity ${activityName}`, () => ({
            activityId: theQcActivityNamed(activityName).id,
          })),
        ),
      ),
    ),

  /**
   * A passive precondition: the activity is assigned — now, unless it already is (a background
   * and its scenario may both state it).
   */
  unlessAssigned: (activityName: string, equipmentName: string): Interaction =>
    Interaction.where(
      d`#actor makes sure the QC activity ${activityName} is assigned to ${equipmentName}`,
      async (actor) => {
        const { activities } = await readQcEquipment(
          actor,
          theEquipmentNamed(equipmentName).id,
        );
        if (activities.some((a) => a.activityName === activityName)) {
          return;
        }
        await Send.a(
          PostRequest.to(activitiesResourceOf(equipmentName)).with({
            activityId: theQcActivityNamed(activityName).id,
          }),
        ).performAs(actor);
        await Ensure.that(LastResponse.status(), equals(201)).performAs(actor);
      },
    ),
};

export const UnassignQcActivity = {
  /** The response is left for the step that judges it. */
  viaApiUsing: (activityName: string, equipmentName: string): Task =>
    Task.where(
      d`#actor unassigns the QC activity ${activityName} from ${equipmentName} (via API)`,
      Send.a(
        DeleteRequest.to(assignmentResourceOf(activityName, equipmentName)),
      ),
    ),

  /** The passive «تخصیص … برداشته شده باشد», checked for its 204. */
  asAPrecondition: (activityName: string, equipmentName: string): Task =>
    Task.where(
      d`#actor has unassigned the QC activity ${activityName} from ${equipmentName}`,
      UnassignQcActivity.viaApiUsing(activityName, equipmentName),
      Ensure.that(LastResponse.status(), equals(204)),
    ),

  /**
   * «فعالیت QC … به تجهیز … تخصیص داده نشده باشد» — already true of an activity only defined; made
   * true by unassigning if it is not.
   */
  unlessUnassigned: (
    activityName: string,
    equipmentName: string,
  ): Interaction =>
    Interaction.where(
      d`#actor makes sure the QC activity ${activityName} is not assigned to ${equipmentName}`,
      async (actor) => {
        const { activities } = await readQcEquipment(
          actor,
          theEquipmentNamed(equipmentName).id,
        );
        if (activities.some((a) => a.activityName === activityName)) {
          await Send.a(
            DeleteRequest.to(assignmentResourceOf(activityName, equipmentName)),
          ).performAs(actor);
          await Ensure.that(LastResponse.status(), equals(204)).performAs(
            actor,
          );
        }
      },
    ),
};

// ---------------------------------------------------------------------------------------------
// Refusals — the attempt's own response

/** «پیغام خطای تکراری بودن تخصیص نشان داده شود». */
export const EnsureToldTheActivityIsAlreadyAssigned = (): Task =>
  Task.where(
    '#actor ensures they were told the QC activity is already assigned',
    EnsureProblemDetail(409, 'qc-activity-already-assigned'),
  );

/** «به او گفته شود که «…» کنار گذاشته شده است» — 409 `equipment-retired`. */
export const EnsureToldTheEquipmentIsRetired = (equipmentName: string): Task =>
  Task.where(
    d`#actor ensures they were told ${equipmentName} is retired`,
    EnsureProblemDetail(409, 'equipment-retired'),
  );

/** «به او گفته شود که «فعالیت» به «تجهیز» تخصیص داده نشده است» — 409 `qc-activity-not-assigned`. */
export const EnsureToldTheActivityIsNotAssigned = (
  activityName: string,
  equipmentName: string,
): Task =>
  Task.where(
    d`#actor ensures they were told ${activityName} is not assigned to ${equipmentName}`,
    EnsureProblemDetail(409, 'qc-activity-not-assigned'),
  );

// ---------------------------------------------------------------------------------------------
// Facts — over the API

const assignedNamesOf = async (
  actor: Parameters<typeof readQcEquipment>[0],
  equipmentName: string,
): Promise<string[]> => {
  const folder = await readQcEquipment(
    actor,
    await theEquipmentIdNamed(actor, equipmentName),
  );
  return folder.activities.map((activity) => activity.activityName);
};

const sorted = (names: string[]): string[] =>
  [...names].sort((a, b) => a.localeCompare(b));

/**
 * «فعالیت های QC تجهیز «…» فقط «…» باشد» / «… «…» و «…» باشند» — exactly these activities are
 * assigned, in whatever order.
 */
export const EnsureTheQcActivitiesOfEquipmentAre = (
  equipmentName: string,
  activityNames: string[],
): Interaction =>
  Interaction.where(
    d`#actor ensures the QC activities of ${equipmentName} are ${activityNames}`,
    async (actor) => {
      await Ensure.that(
        sorted(await assignedNamesOf(actor, equipmentName)),
        equals(sorted(activityNames)),
      ).performAs(actor);
    },
  );

/**
 * «فعالیت QC «…» فقط یک بار در فعالیت های QC تجهیز «…» باشد», «… (همچنان) به تجهیز «…» تخصیص داده
 * شده باشد» (once), «… در فعالیت های QC تجهیز «…» نباشد» (never).
 */
export const EnsureTheQcActivityIsAssignedTimes = (
  activityName: string,
  equipmentName: string,
  times: 0 | 1,
): Interaction =>
  Interaction.where(
    d`#actor ensures ${activityName} is assigned to ${equipmentName} ${times} time(s)`,
    async (actor) => {
      const assigned = (await assignedNamesOf(actor, equipmentName)).filter(
        (name) => name === activityName,
      );
      await Ensure.that(assigned.length, equals(times)).performAs(actor);
    },
  );

/** The equipment's activities before an attempt, so «… تغییر نکرده باشد» can compare with them. */
let activitiesBeforeTheAttempt: QcEquipmentReadModel | undefined;

export const forgetTheNotedQcAssignments = (): void => {
  activitiesBeforeTheAttempt = undefined;
};

export const NoteTheQcActivitiesOf = (equipmentName: string): Interaction =>
  Interaction.where(
    d`#actor notes the QC activities of ${equipmentName}`,
    async (actor) => {
      activitiesBeforeTheAttempt = await readQcEquipment(
        actor,
        theEquipmentNamed(equipmentName).id,
      );
    },
  );

/** «فعالیت های QC تجهیز «…» تغییر نکرده باشد» — the folder reads as it did before the attempt. */
export const EnsureTheQcActivitiesOfEquipmentAreAsBefore = (
  equipmentName: string,
): Interaction =>
  Interaction.where(
    d`#actor ensures the QC activities of ${equipmentName} are as they were`,
    async (actor) => {
      if (!activitiesBeforeTheAttempt) {
        throw new Error(
          `The QC activities of "${equipmentName}" were not noted before the attempt.`,
        );
      }
      await Ensure.that(
        await readQcEquipment(actor, theEquipmentNamed(equipmentName).id),
        equals(activitiesBeforeTheAttempt),
      ).performAs(actor);
    },
  );

/**
 * «انجام «…» (دوباره) روی تجهیز «…» قابل ثبت باشد / دیگر … قابل ثبت نباشد» — what the inspector's
 * scan of the equipment offers: `GET qc-inspections/:equipmentId` lists the activity, and the
 * equipment is in service. Read rather than tried, so the fact leaves no record behind.
 */
export const EnsureTheQcActivityIsRecordable = (
  activityName: string,
  equipmentName: string,
  recordable: boolean,
): Interaction =>
  Interaction.where(
    d`#actor ensures ${activityName} is ${recordable ? '' : 'not '}recordable on ${equipmentName}`,
    async (actor) => {
      await Send.a(
        GetRequest.to(
          `qc-inspections/${await theEquipmentIdNamed(actor, equipmentName)}`,
        ),
      ).performAs(actor);
      await Ensure.that(LastResponse.status(), equals(200)).performAs(actor);
      const view = await actor.answer(
        LastResponse.body<QcEquipmentReadModel>(),
      );
      const offered =
        !view.retired &&
        view.activities.some((a) => a.activityName === activityName);
      await Ensure.that(offered, equals(recordable)).performAs(actor);
    },
  );
