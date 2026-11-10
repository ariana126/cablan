import { d, Interaction, Question, Task } from '@serenity-js/core';
import { Ensure, equals, isGreaterThan } from '@serenity-js/assertions';
import { GetRequest, LastResponse, Send } from '@serenity-js/rest';
import { jalaliDateToIsoDate } from '../common/jalali-datetime';
import { MaintenanceHistoryRange } from '../common/maintenance-history-view-context';
import {
  ApiReader,
  MaintenanceHistoryEntryReadModel,
  maintenanceHistoryResource,
  occurrenceStatusLabels,
  readMaintenanceHistory,
} from './maintenance-api';
import {
  theEquipmentNamed,
  theMaintenanceTaskNamed,
} from './maintenance-records';

/**
 * Issue #114: an equipment's maintenance history lists, beside every recording, each occurrence
 * nobody recorded before the next one came due — «انجام نشده», with nobody and no time. What the
 * history holds, and which entries a range selects (a recording by its Tehran day, a missed
 * occurrence by its due date), are the backend's rules, so the history is looked at and read over
 * `GET equipment/:id/maintenance-history[?from&to]`.
 */

export const ViewMaintenanceHistory = {
  /** As the actor — anyone who works in maintenance may — the whole history or one range. */
  viaApiUsing: (equipmentName: string, range?: MaintenanceHistoryRange): Task =>
    Task.where(
      d`#actor looks at the maintenance history of ${equipmentName} for ${range ?? 'all time'}`,
      Send.a(
        GetRequest.to(
          Question.about(`the maintenance history of ${equipmentName}`, () =>
            maintenanceHistoryResource(
              theEquipmentNamed(equipmentName).id,
              range,
            ),
          ),
        ),
      ),
      Ensure.that(LastResponse.status(), equals(200)),
    ),
};

/** The entries — of any kind — of `equipmentName` due on `dueDate`, within the range if any. */
const entriesDueOn = async (
  actor: ApiReader,
  equipmentName: string,
  dueDate: string,
  range?: MaintenanceHistoryRange,
): Promise<MaintenanceHistoryEntryReadModel[]> =>
  (
    await readMaintenanceHistory(
      actor,
      theEquipmentNamed(equipmentName).id,
      range,
    )
  ).filter((entry) => entry.dueDate === jalaliDateToIsoDate(dueDate));

/**
 * «وضعیت تعویض روغن اکسترودر 1 برای موعد «…» در سابقه تعمیرات اکسترودر 1 «…» باشد» — the history
 * holds exactly one entry for that occurrence, and its status reads as the Gherkin writes it
 * («بموقع», «با تاخیر», «انجام نشده»).
 */
export const EnsureHistoryStatusFor = (
  maintenanceTask: string,
  dueDate: string,
  status: string,
  range?: MaintenanceHistoryRange,
): Interaction =>
  Interaction.where(
    d`#actor ensures the history shows ${maintenanceTask} due ${dueDate} as ${status}`,
    async (actor) => {
      const { activityName, equipmentName } =
        theMaintenanceTaskNamed(maintenanceTask);
      const statuses = (
        await entriesDueOn(actor, equipmentName, dueDate, range)
      )
        .filter((entry) => entry.activityName === activityName)
        .map((entry) => occurrenceStatusLabels[entry.status]);
      await Ensure.that(statuses, equals([status])).performAs(actor);
    },
  );

/**
 * «انجام دهنده ای برای موعد «…» در سابقه تعمیرات اکسترودر 1 نباشد» — the history does list that
 * occurrence, and no entry of it names anybody.
 */
export const EnsureNobodyPerformedInHistory = (
  equipmentName: string,
  dueDate: string,
  range?: MaintenanceHistoryRange,
): Interaction =>
  Interaction.where(
    d`#actor ensures the history of ${equipmentName} names nobody for ${dueDate}`,
    async (actor) => {
      const entries = await entriesDueOn(actor, equipmentName, dueDate, range);
      await Ensure.that(entries.length, isGreaterThan(0)).performAs(actor);
      await Ensure.that(
        entries
          .map((entry) => entry.performedBy)
          .filter((performer) => performer !== null),
        equals([]),
      ).performAs(actor);
    },
  );
