import {
  AnswersQuestions,
  CollectsArtifacts,
  UsesAbilities,
} from '@serenity-js/core';
import { Ensure, equals } from '@serenity-js/assertions';
import { GetRequest, LastResponse, Send } from '@serenity-js/rest';

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

export interface EquipmentDetailsReadModel extends EquipmentReadModel {
  planItems: PmPlanItemReadModel[];
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

export interface PmOccurrenceReadModel {
  equipmentId: string;
  equipmentName: string;
  planItemId: string;
  activityName: string;
  dueDate: string;
  status: OccurrenceStatus;
  performedAt: string | null;
  performedBy: string | null;
}

export interface MaintenanceExecutionReadModel {
  id: string;
  activityName: string;
  dueDate: string;
  performedAt: string;
  performedBy: string;
  status: 'on_time' | 'late';
  notes: string | null;
}

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
): Promise<PmOccurrenceReadModel[]> => read(actor, 'pm-schedule/overview');

export const readMaintenanceHistory = (
  actor: ApiReader,
  equipmentId: string,
): Promise<MaintenanceExecutionReadModel[]> =>
  read(actor, `equipment/${equipmentId}/maintenance-history`);
