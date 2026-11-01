import {
  AnswersQuestions,
  CollectsArtifacts,
  UsesAbilities,
} from '@serenity-js/core';
import { Ensure, equals } from '@serenity-js/assertions';
import { GetRequest, LastResponse, Send } from '@serenity-js/rest';
import { jalaliDateToIsoDate } from '../common/jalali-datetime';

/**
 * The maintenance API's read side, as `docs/superpowers/plans/2026-10-29-maintenance-management.md`
 * pins it, and reads that a domain `Interaction` performs as whichever actor it runs as. Dates are
 * ISO `YYYY-MM-DD`; instants ISO-8601.
 */

export interface EquipmentReadModel {
  id: string;
  name: string;
  retired: boolean;
}

export interface PmPlanItemReadModel {
  id: string;
  activityId: string;
  activityName: string;
  intervalDays: number;
  firstDueDate: string;
  nextDueDate: string;
}

/**
 * A deactivated plan row (issue #91): read-only, with the last interval and the first due date of
 * its schedule, and the instant it was deactivated (ISO-8601). Re-adding the activity afterwards
 * makes a new, active row with its own id — this one stays as it was.
 */
export interface InactivePmPlanItemReadModel {
  id: string;
  activityId: string;
  activityName: string;
  intervalDays: number;
  firstDueDate: string;
  deactivatedAt: string;
}

export interface EquipmentDetailsReadModel extends EquipmentReadModel {
  /** Active rows only. */
  planItems: PmPlanItemReadModel[];
  /** Deactivated rows, `deactivatedAt` ascending. */
  inactivePlanItems: InactivePmPlanItemReadModel[];
}

export interface MaintenanceActivityReadModel {
  id: string;
  name: string;
}

export interface DailyPmTaskReadModel {
  equipmentId: string;
  equipmentName: string;
  planItemId: string;
  activityId: string;
  activityName: string;
  dueDate: string;
  status: 'due' | 'overdue';
  daysOverdue: number;
}

export type OccurrenceStatus =
  'on_time' | 'late' | 'missed' | 'overdue' | 'due' | 'upcoming';

/**
 * One row of `GET pm-schedule/overview` (and `…/calendar`) — issue #90's `PmOccurrence`
 * (`docs/superpowers/plans/2026-11-01-pm-schedule-calendar.md`, "HTTP contract (pinned)").
 */
export interface PmOccurrenceReadModel {
  equipmentId: string;
  equipmentName: string;
  equipmentRetired: boolean;
  planItemId: string;
  activityId: string;
  activityName: string;
  dueDate: string;
  /** The Tehran date performed when `late`, the due date otherwise — where the calendar puts it. */
  calendarDate: string;
  status: OccurrenceStatus;
  performedAt: string | null;
  performedById: string | null;
  performedBy: string | null;
  /** Whole Tehran days from the due date to the recording — a positive integer when `late`, else null. */
  daysLate: number | null;
  notes: string | null;
}

/**
 * The due-date range `GET pm-schedule/overview` requires (issue #90), in Jalali `YYYY/MM/DD` as the
 * Gherkin writes it. Either bound may be left out — only to try the 400
 * `invalid-pm-schedule-range` that follows.
 */
export interface PmScheduleRange {
  from?: string;
  to?: string;
}

/** `pm-schedule/overview?from=…&to=…`, the bounds as ISO dates; a missing bound is not sent. */
export const pmOverviewResource = ({ from, to }: PmScheduleRange): string => {
  const query = new URLSearchParams();
  if (from !== undefined) {
    query.set('from', jalaliDateToIsoDate(from));
  }
  if (to !== undefined) {
    query.set('to', jalaliDateToIsoDate(to));
  }
  const search = query.toString();
  return search === ''
    ? 'pm-schedule/overview'
    : `pm-schedule/overview?${search}`;
};

export interface MaintenanceExecutionReadModel {
  id: string;
  activityName: string;
  dueDate: string;
  performedAt: string;
  performedBy: string;
  status: 'on_time' | 'late';
  notes: string | null;
  /** As on an overview occurrence: a positive integer when `late`, else null. */
  daysLate: number | null;
}

/** A delay amount as the business writes it — «6 روز», or «-» when there is none. */
export const delayAmountLabel = (daysLate: number | null): string =>
  daysLate === null ? '-' : `${daysLate} روز`;

/** The statuses as the business names them — the Gherkin's words, and the pages'. */
export const occurrenceStatusLabels: Record<OccurrenceStatus, string> = {
  on_time: 'بموقع',
  late: 'با تاخیر',
  missed: 'انجام نشده',
  overdue: 'عقب افتاده',
  due: 'سررسیده',
  upcoming: 'آینده',
};

export type ApiReader = UsesAbilities & AnswersQuestions & CollectsArtifacts;

const read = async <T>(actor: ApiReader, resource: string): Promise<T> => {
  await Send.a(GetRequest.to(resource)).performAs(actor);
  await Ensure.that(LastResponse.status(), equals(200)).performAs(actor);
  return actor.answer(LastResponse.body<T>());
};

export const readEquipmentList = (
  actor: ApiReader,
): Promise<EquipmentReadModel[]> => read(actor, 'equipment');

export const readEquipment = (
  actor: ApiReader,
  equipmentId: string,
): Promise<EquipmentDetailsReadModel> =>
  read(actor, `equipment/${equipmentId}`);

export const readMaintenanceActivities = (
  actor: ApiReader,
): Promise<MaintenanceActivityReadModel[]> =>
  read(actor, 'maintenance-activities');

export const readDailyPmSchedule = (
  actor: ApiReader,
): Promise<DailyPmTaskReadModel[]> => read(actor, 'pm-schedule/daily');

export const readPmOverview = (
  actor: ApiReader,
  range: Required<PmScheduleRange>,
): Promise<PmOccurrenceReadModel[]> => read(actor, pmOverviewResource(range));

export const readMaintenanceHistory = (
  actor: ApiReader,
  equipmentId: string,
): Promise<MaintenanceExecutionReadModel[]> =>
  read(actor, `equipment/${equipmentId}/maintenance-history`);
