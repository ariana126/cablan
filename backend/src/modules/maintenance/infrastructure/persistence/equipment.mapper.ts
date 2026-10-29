import { Identity } from '@framework/domain';
import { Equipment } from '@maintenance/domain/equipment.aggregate';
import { PmPlanItem } from '@maintenance/domain/pm-plan-item.entity';
import { CalendarDate } from '@maintenance/domain/value/calendar-date.vo';
import { EquipmentName } from '@maintenance/domain/value/equipment-name.vo';
import { IntervalDays } from '@maintenance/domain/value/interval-days.vo';
import { PmSchedule } from '@maintenance/domain/value/pm-schedule.vo';

/** One stored schedule segment — the `pm_plan_item.schedule` JSON's element. */
export interface PmScheduleSegmentRecord {
  startDueDate: string;
  intervalDays: number;
}

export interface PmPlanItemRecord {
  id: string;
  position: number;
  activityId: string;
  activityName: string;
  schedule: PmScheduleSegmentRecord[];
  removedAt: Date | null;
}

// Only what the domain owns; `createdAt`/`updatedAt` are the database's.
export interface EquipmentRecord {
  id: string;
  name: string;
  retiredAt: Date | null;
  /** In plan order (`position`). */
  planItems: PmPlanItemRecord[];
}

export const EquipmentMapper = {
  toDomain(record: EquipmentRecord): Equipment {
    return Equipment.fromPersistence(
      Identity.fromString(record.id),
      EquipmentName.fromString(record.name),
      record.retiredAt,
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
              })),
            ),
            item.removedAt,
          ),
        ),
    );
  },

  toPersistence(entity: Equipment): EquipmentRecord {
    return {
      id: entity.id.asString(),
      name: entity.name().asString(),
      retiredAt: entity.retiredAt(),
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
          })),
        removedAt: item.removedAt(),
      })),
    };
  },
};
