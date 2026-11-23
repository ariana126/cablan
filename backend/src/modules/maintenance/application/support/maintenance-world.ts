import { Identity } from '@framework/domain';
import { Equipment } from '@maintenance/domain/equipment.aggregate';
import { MaintenanceActivity } from '@maintenance/domain/maintenance-activity.aggregate';
import { MaintenanceExecution } from '@maintenance/domain/maintenance-execution.aggregate';
import { ReadonlyPmPlanItem } from '@maintenance/domain/pm-plan-item.entity';
import { QcActivity } from '@maintenance/domain/qc-activity.aggregate';
import { QcExecution } from '@maintenance/domain/qc-execution.aggregate';
import { ActivitySpecialty } from '@maintenance/domain/value/activity-specialty.vo';
import { CalendarDate } from '@maintenance/domain/value/calendar-date.vo';
import { EquipmentName } from '@maintenance/domain/value/equipment-name.vo';
import { IntervalDays } from '@maintenance/domain/value/interval-days.vo';
import { MaintenanceActivityName } from '@maintenance/domain/value/maintenance-activity-name.vo';
import { OperatingHours } from '@maintenance/domain/value/operating-hours.vo';
import { QcActivityName } from '@maintenance/domain/value/qc-activity-name.vo';
import { QcTrackingNumber } from '@maintenance/domain/value/qc-tracking-number.vo';

import { FixedClock, tehranMorningOf } from './fixed-clock';
import { InMemoryEquipmentRepository } from './in-memory-equipment-repository';
import { InMemoryMaintenanceActivityRepository } from './in-memory-maintenance-activity-repository';
import { InMemoryMaintenanceExecutionRepository } from './in-memory-maintenance-execution-repository';
import { InMemoryQcActivityRepository } from './in-memory-qc-activity-repository';
import { InMemoryQcAssignmentReader } from './in-memory-qc-assignment-reader';
import { InMemoryQcExecutionReader } from './in-memory-qc-execution-reader';
import { InMemoryQcExecutionRepository } from './in-memory-qc-execution-repository';

/** What a seeded QC record may say besides its equipment, activity and time. */
export interface QcRecordDetails {
  readonly performer?: { readonly id: Identity; readonly name: string };
  readonly trackingNumber?: string;
  readonly notes?: string | null;
  /** The submission it was sent in (issue #132); none unless said. */
  readonly submissionId?: Identity;
}

/**
 * The query specs' arrangement: in-memory repositories, a clock on a Tehran
 * date, and terse ways to seed equipment, activities, plan items and
 * executions — and production QC's activities, assignments and records
 * (issue #119).
 */
export class MaintenanceWorld {
  readonly equipmentRepository = new InMemoryEquipmentRepository();
  readonly activityRepository = new InMemoryMaintenanceActivityRepository();
  readonly executionRepository = new InMemoryMaintenanceExecutionRepository();
  readonly qcActivityRepository = new InMemoryQcActivityRepository();
  readonly qcExecutionRepository = new InMemoryQcExecutionRepository();
  readonly qcExecutionReader = new InMemoryQcExecutionReader(
    this.qcExecutionRepository,
    this.equipmentRepository,
    this.qcActivityRepository,
  );
  readonly qcAssignmentReader = new InMemoryQcAssignmentReader(
    this.equipmentRepository,
    this.qcActivityRepository,
  );
  readonly clock: FixedClock;

  constructor(today: string) {
    this.clock = new FixedClock(tehranMorningOf(today));
  }

  /** A catalog activity; mechanical unless said otherwise. */
  activity(
    name: string,
    specialty: ActivitySpecialty = ActivitySpecialty.mechanical(),
  ): MaintenanceActivity {
    return this.activityRepository.seed(
      MaintenanceActivity.register(
        MaintenanceActivityName.fromString(name),
        specialty,
      ),
    );
  }

  /** An activity registered before specialties existed: it has none. */
  activityWithoutSpecialty(name: string): MaintenanceActivity {
    return this.activityRepository.seed(
      MaintenanceActivity.fromPersistence(
        Identity.new(),
        MaintenanceActivityName.fromString(name),
        null,
      ),
    );
  }

  equipment(name: string): Equipment {
    return this.equipmentRepository.seed(
      Equipment.register(EquipmentName.fromString(name)),
    );
  }

  planItem(
    equipment: Equipment,
    activity: MaintenanceActivity,
    intervalDays: number,
    firstDueDate: string,
  ): ReadonlyPmPlanItem {
    const item = equipment.addPlanItem(
      activity,
      IntervalDays.of(intervalDays),
      CalendarDate.fromString(firstDueDate),
    );
    equipment.releaseEvents();
    return item;
  }

  executed(
    equipment: Equipment,
    item: ReadonlyPmPlanItem,
    dueDate: string,
    performedAt: Date,
    performedByName = 'مسلمی',
    notes: string | null = null,
    performedById: Identity = Identity.new(),
    operatingHours: OperatingHours | null = null,
  ): MaintenanceExecution {
    return this.executionRepository.seed(
      MaintenanceExecution.record({
        equipmentId: equipment.id,
        equipmentName: equipment.name().asString(),
        planItemId: item.id,
        activityId: item.activityId(),
        activityName: item.activityName(),
        dueDate: CalendarDate.fromString(dueDate),
        performedAt,
        performedById,
        performedByName,
        notes,
        operatingHours,
      }),
    );
  }

  qcActivity(name: string): QcActivity {
    return this.qcActivityRepository.seed(
      QcActivity.define(QcActivityName.fromString(name)),
    );
  }

  /** `activities` assigned to `equipment`, which must be in service. */
  qcAssigned(equipment: Equipment, ...activities: QcActivity[]): void {
    for (const activity of activities) {
      equipment.assignQcActivity(activity);
    }
    equipment.releaseEvents();
  }

  /**
   * A QC record of `activity` on `equipment` at `performedAt` — assigned to
   * it or not (a record outlives its assignment), by نیکروش for TR-100
   * unless said otherwise.
   */
  qcRecorded(
    equipment: Equipment,
    activity: QcActivity,
    performedAt: Date,
    details: QcRecordDetails = {},
  ): QcExecution {
    const performer = details.performer ?? NIKROOZ;
    return this.qcExecutionRepository.seed(
      QcExecution.record(
        {
          equipmentId: equipment.id,
          activityId: activity.id,
          performedById: performer.id,
          performedByName: performer.name,
          performedAt,
          trackingNumber: QcTrackingNumber.fromString(
            details.trackingNumber ?? 'TR-100',
          ),
          notes: details.notes ?? null,
          submissionId: details.submissionId ?? null,
        },
        {
          equipmentName: equipment.name().asString(),
          activityName: activity.name().asString(),
        },
      ),
    );
  }
}

/** The QC inspector of the examples. */
export const NIKROOZ = { id: Identity.new(), name: 'نیکروش' };
