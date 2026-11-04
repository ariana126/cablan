import { Identity } from '@framework/domain';
import { Equipment } from '@maintenance/domain/equipment.aggregate';
import { PmPlanItem } from '@maintenance/domain/pm-plan-item.entity';
import { CalendarDate } from '@maintenance/domain/value/calendar-date.vo';
import { EquipmentName } from '@maintenance/domain/value/equipment-name.vo';
import { IntervalDays } from '@maintenance/domain/value/interval-days.vo';
import { PmSchedule } from '@maintenance/domain/value/pm-schedule.vo';
import { ServiceBreak } from '@maintenance/domain/value/service-break.vo';

/**
 * One stored schedule segment — the `pm_plan_item.schedule` JSON's element.
 * `restartedOn` is present only on a restart given at reactivation (issue
 * #110); every segment stored before then lacks it.
 */
export interface PmScheduleSegmentRecord {
  startDueDate: string;
  intervalDays: number;
  restartedOn?: string;
}

export interface PmPlanItemRecord {
  id: string;
  position: number;
  activityId: string;
  activityName: string;
  schedule: PmScheduleSegmentRecord[];
  deactivatedAt: Date | null;
}

/** One `equipment_service_break` row (issue #110). */
export interface ServiceBreakRecord {
  position: number;
  retiredAt: Date;
  reactivatedAt: Date | null;
}

// Only what the domain owns; `createdAt`/`updatedAt` are the database's.
export interface EquipmentRecord {
  id: string;
  name: string;
  /** In order (`position`), oldest first. */
  serviceBreaks: ServiceBreakRecord[];
  /** In plan order (`position`). */
  planItems: PmPlanItemRecord[];
}

export const EquipmentMapper = {
  toDomain(record: EquipmentRecord): Equipment {
    return Equipment.fromPersistence(
      Identity.fromString(record.id),
      EquipmentName.fromString(record.name),
      record.serviceBreaks
        .toSorted((left, right) => left.position - right.position)
        .map((serviceBreak) =>
          ServiceBreak.restore(
            serviceBreak.retiredAt,
            serviceBreak.reactivatedAt,
          ),
        ),
      record.planItems
        .toSorted((left, right) => left.position - right.position)
        .map((item) =>
          PmPlanItem.fromPersistence(
            Identity.fromString(item.id),
            Identity.fromString(item.activityId),
            item.activityName,
            PmSchedule.fromSegments(
              item.schedule.map((segment) => ({
                startDueDate: CalendarDate.fromString(segment.startDueDate),
                intervalDays: IntervalDays.of(segment.intervalDays),
                ...(segment.restartedOn === undefined
                  ? {}
                  : {
                      restartedOn: CalendarDate.fromString(segment.restartedOn),
                    }),
              })),
            ),
            item.deactivatedAt,
          ),
        ),
    );
  },

  toPersistence(entity: Equipment): EquipmentRecord {
    return {
      id: entity.id.asString(),
      name: entity.name().asString(),
      serviceBreaks: entity.serviceBreaks().map((serviceBreak, position) => ({
        position,
        retiredAt: serviceBreak.retiredAt(),
        reactivatedAt: serviceBreak.reactivatedAt(),
      })),
      planItems: entity.planItems().map((item, position) => ({
        id: item.id.asString(),
        position,
        activityId: item.activityId().asString(),
        activityName: item.activityName(),
        schedule: item
          .schedule()
          .segments()
          .map((segment) => ({
            startDueDate: segment.startDueDate.asString(),
            intervalDays: segment.intervalDays.asNumber(),
            ...(segment.restartedOn
              ? { restartedOn: segment.restartedOn.asString() }
              : {}),
          })),
        deactivatedAt: item.deactivatedAt(),
      })),
    };
  },
};
