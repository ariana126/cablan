import { domainErrorSchema } from '@framework/infrastructure';

// The OpenAPI shapes of the maintenance read models and problems, shared by
// the module's controllers. Field names are the plan's
// (docs/superpowers/plans/2026-10-29-maintenance-management.md).

const ID = { type: 'string', example: '550e8400-e29b-41d4-a716-446655440000' };
const DATE = { type: 'string', format: 'date', example: '2026-10-02' };
const INSTANT = {
  type: 'string',
  format: 'date-time',
  example: '2026-10-02T06:30:00.000Z',
};

const DAYS_LATE = {
  type: 'integer',
  nullable: true,
  minimum: 1,
  example: 2,
  description:
    'Whole Tehran days after the due date it was done; null unless late',
};

export const CreatedIdSchema = { properties: { id: ID } };

export const EquipmentSchema = {
  properties: {
    id: ID,
    name: { type: 'string', example: 'اکسترودر ۱' },
    retired: { type: 'boolean', example: false },
  },
};

export const EquipmentListItemSchema = {
  properties: {
    ...EquipmentSchema.properties,
    activePlanItemCount: {
      type: 'integer',
      minimum: 0,
      example: 3,
      description: 'Items in the PM plan now; deactivated items excluded',
    },
  },
};

export const PmPlanItemSchema = {
  properties: {
    id: ID,
    activityId: ID,
    activityName: { type: 'string', example: 'تعویض روغن' },
    intervalDays: { type: 'integer', example: 30 },
    firstDueDate: DATE,
    nextDueDate: DATE,
  },
};

export const InactivePmPlanItemSchema = {
  properties: {
    id: ID,
    activityId: ID,
    activityName: {
      type: 'string',
      example: 'تعویض روغن',
      description: 'The activity’s current catalog name',
    },
    intervalDays: {
      type: 'integer',
      example: 30,
      description:
        'The interval of its schedule’s last segment — the last one it was planned with',
    },
    firstDueDate: DATE,
    deactivatedAt: INSTANT,
  },
};

export const EquipmentDetailSchema = {
  properties: {
    ...EquipmentSchema.properties,
    planItems: {
      type: 'array',
      items: PmPlanItemSchema,
      description: 'Active items, in the order they were added',
    },
    inactivePlanItems: {
      type: 'array',
      items: InactivePmPlanItemSchema,
      description:
        'Deactivated items, read-only: earliest deactivated first, then in the order they were added',
    },
  },
};

export const MaintenanceActivitySchema = {
  properties: { id: ID, name: { type: 'string', example: 'تعویض روغن' } },
};

export const DailyPmTaskSchema = {
  properties: {
    equipmentId: ID,
    equipmentName: { type: 'string', example: 'اکسترودر ۱' },
    planItemId: ID,
    activityId: ID,
    activityName: { type: 'string', example: 'تعویض روغن' },
    dueDate: DATE,
    status: { type: 'string', enum: ['due', 'overdue'] },
    daysOverdue: { type: 'integer', example: 3 },
  },
};

export const PmOccurrenceSchema = {
  properties: {
    equipmentId: ID,
    equipmentName: { type: 'string', example: 'اکسترودر ۱' },
    equipmentRetired: { type: 'boolean', example: false },
    planItemId: ID,
    activityId: ID,
    activityName: {
      type: 'string',
      example: 'تعویض روغن',
      description: 'The activity’s current catalog name',
    },
    dueDate: DATE,
    calendarDate: {
      ...DATE,
      description:
        'The day the calendar shows it on: the Tehran date performed when late, else dueDate',
    },
    status: {
      type: 'string',
      enum: ['on_time', 'late', 'missed', 'overdue', 'due', 'upcoming'],
    },
    performedAt: { ...INSTANT, nullable: true },
    performedById: { ...ID, nullable: true },
    performedBy: {
      type: 'string',
      nullable: true,
      example: 'مسلمی',
      description: 'The performer’s display name when it was done',
    },
    daysLate: DAYS_LATE,
    notes: { type: 'string', nullable: true, example: 'فیلتر هم عوض شد' },
  },
};

const NAMED_OPTION = {
  properties: { id: ID, name: { type: 'string', example: 'تعویض روغن' } },
};

export const PmScheduleFilterOptionsSchema = {
  properties: {
    equipment: {
      type: 'array',
      items: EquipmentSchema,
      description: 'Every piece of equipment, retired included, by name',
    },
    activities: {
      type: 'array',
      items: NAMED_OPTION,
      description: 'The whole activity catalog, by name',
    },
    performers: {
      type: 'array',
      items: {
        properties: { id: ID, name: { type: 'string', example: 'مسلمی' } },
      },
      description:
        'Every distinct performer of an execution (user id, latest name), by name',
    },
  },
};

const COUNT = { type: 'integer', minimum: 0, example: 3 };
const PERCENT = {
  type: 'integer',
  nullable: true,
  minimum: 0,
  maximum: 100,
  example: 70,
  description: 'Whole percent; null when there is nothing to judge',
};
const STATUS = {
  type: 'string',
  enum: ['on_time', 'late', 'missed', 'overdue', 'due', 'upcoming'],
};

const PmDashboardTrendPointSchema = {
  properties: {
    from: DATE,
    to: DATE,
    considered: COUNT,
    onTime: COUNT,
    late: COUNT,
    adherencePercent: PERCENT,
    completionPercent: PERCENT,
  },
};

export const PmDashboardSchema = {
  properties: {
    today: { ...DATE, description: 'Today, in Tehran' },
    generatedAt: INSTANT,
    periodDays: { type: 'integer', enum: [7, 30, 90], example: 30 },
    periodFrom: { ...DATE, description: 'today − (periodDays − 1)' },
    periodTo: { ...DATE, description: 'today' },
    current: {
      description:
        'Today’s work, whatever the period: due and overdue on active items of equipment in service, and every job performed today',
      properties: { dueToday: COUNT, overdue: COUNT, doneToday: COUNT },
    },
    missedCount: {
      ...COUNT,
      description:
        'Missed occurrences whose missedOn (the day they turned missed) is in [periodFrom, today]',
    },
    performance: {
      description:
        'The occurrences due in [periodFrom, today − 1]: today and the future are left out',
      properties: {
        considered: COUNT,
        onTime: COUNT,
        late: COUNT,
        notDone: { ...COUNT, description: 'Overdue or missed' },
        adherencePercent: {
          ...PERCENT,
          description: 'round(100·onTime/considered); null when considered = 0',
        },
        completionPercent: {
          ...PERCENT,
          description:
            'round(100·(onTime+late)/considered); null when considered = 0',
        },
        averageDaysLate: {
          type: 'number',
          nullable: true,
          example: 3,
          description:
            'Mean daysLate of the late ones, one decimal; null when none',
        },
      },
    },
    trend: {
      properties: {
        daily: {
          type: 'array',
          items: PmDashboardTrendPointSchema,
          description:
            'One point per day of [periodFrom, today − 1], oldest first',
        },
        weekly: {
          type: 'array',
          items: PmDashboardTrendPointSchema,
          description:
            '7-day points counted back from today − 1, oldest first; the oldest clipped at periodFrom',
        },
      },
    },
    coverage: {
      description:
        'Plant-wide, whatever equipmentId: equipment in service, and which has at least one active plan item',
      properties: {
        activeEquipment: COUNT,
        withPlan: COUNT,
        withoutPlan: COUNT,
        coveragePercent: {
          ...PERCENT,
          description:
            'round(100·withPlan/activeEquipment); null when activeEquipment = 0',
        },
        equipmentWithoutPlan: {
          type: 'array',
          items: NAMED_OPTION,
          description: 'By name',
        },
      },
    },
    mostOverdueEquipment: {
      type: 'array',
      description:
        'Equipment with ≥ 1 overdue occurrence (missed excluded) on an active item: overdueCount desc, totalDaysOverdue desc, then name',
      items: {
        properties: {
          equipmentId: ID,
          equipmentName: { type: 'string', example: 'اکسترودر ۱' },
          overdueCount: COUNT,
          totalDaysOverdue: COUNT,
        },
      },
    },
    upcoming: {
      type: 'array',
      description:
        'Upcoming occurrences of active items due in [today + 1, today + 7], by due date, equipment name, plan order',
      items: {
        properties: {
          equipmentId: ID,
          equipmentName: { type: 'string', example: 'اکسترودر ۱' },
          planItemId: ID,
          activityName: { type: 'string', example: 'تعویض روغن' },
          dueDate: DATE,
        },
      },
    },
    occurrences: {
      type: 'array',
      description:
        'The follow-up table: every occurrence due in [periodFrom, today + 7], each item’s one just before periodFrom while overdue or turned missed inside the period, and any performed today; by equipment name, plan order, due date',
      items: {
        properties: {
          equipmentId: ID,
          equipmentName: { type: 'string', example: 'اکسترودر ۱' },
          equipmentRetired: { type: 'boolean', example: false },
          planItemId: ID,
          activityId: ID,
          activityName: {
            type: 'string',
            example: 'تعویض روغن',
            description: 'The activity’s current catalog name',
          },
          dueDate: DATE,
          status: STATUS,
          daysOverdue: {
            type: 'integer',
            minimum: 0,
            example: 3,
            description: 'Days since the due date while overdue; 0 otherwise',
          },
          daysLate: DAYS_LATE,
          missedOn: {
            ...DATE,
            nullable: true,
            description:
              'The day it turned missed — the schedule’s next due date after it; null unless missed',
          },
          performedAt: { ...INSTANT, nullable: true },
          performedByName: {
            type: 'string',
            nullable: true,
            example: 'مسلمی',
          },
          notes: { type: 'string', nullable: true, example: 'فیلتر هم عوض شد' },
          doneToday: {
            type: 'boolean',
            example: false,
            description: 'Performed today (Tehran), whatever its due date',
          },
          recordable: {
            type: 'boolean',
            example: true,
            description:
              'due or overdue, on an active item of equipment in service — POST …/executions takes it',
          },
        },
      },
    },
  },
};

export const InvalidPmScheduleRangeResponse = {
  description:
    'A validation error for a malformed parameter or a date outside years 2000–2100, or `invalid-pm-schedule-range` for a missing or empty `from`/`to`, `from` after `to`, or a range over 3660 days (detail «بازه تاریخ نمی تواند بیشتر از ده سال باشد.»)',
  schema: domainErrorSchema(
    'invalid-pm-schedule-range',
    'Invalid PM Schedule Range',
    400,
    'بازه تاریخ باید تاریخ شروع و پایان داشته باشد و تاریخ شروع بعد از تاریخ پایان نباشد.',
  ),
};

export const MaintenanceExecutionSchema = {
  properties: {
    id: ID,
    activityName: { type: 'string', example: 'تعویض روغن' },
    dueDate: DATE,
    performedAt: INSTANT,
    performedBy: { type: 'string', example: 'مسلمی' },
    status: { type: 'string', enum: ['on_time', 'late'] },
    notes: { type: 'string', nullable: true, example: 'فیلتر هم عوض شد' },
    daysLate: DAYS_LATE,
  },
};

export const RecordedExecutionSchema = {
  properties: { id: ID, dueDate: DATE },
};

export const ForbiddenResponse = {
  description: 'The signed-in user’s role may not do this',
  schema: { properties: { title: { type: 'string', example: 'Forbidden' } } },
};

export const EquipmentNameTakenResponse = {
  schema: domainErrorSchema(
    'equipment-name-taken',
    'Equipment Name Taken',
    409,
    'تجهیزی با این نام قبلا ثبت شده است',
    { name: { type: 'string', example: 'اکسترودر ۱' } },
  ),
};

export const MaintenanceActivityNameTakenResponse = {
  schema: domainErrorSchema(
    'maintenance-activity-name-taken',
    'Maintenance Activity Name Taken',
    409,
    'فعالیتی با این نام قبلا ثبت شده است',
    { name: { type: 'string', example: 'تعویض روغن' } },
  ),
};

export const EquipmentRetiredResponse = {
  schema: domainErrorSchema(
    'equipment-retired',
    'Equipment Retired',
    409,
    'این تجهیز کنار گذاشته شده است',
    { equipmentId: ID },
  ),
};

export const PmPlanItemConflictResponse = {
  description:
    '`activity-already-in-pm-plan`, `equipment-retired`, `pm-plan-item-deactivated` or `pm-occurrence-already-recorded`',
  schema: domainErrorSchema(
    'pm-plan-item-deactivated',
    'PM Plan Item Deactivated',
    409,
    'این فعالیت در برنامهٔ تجهیز غیرفعال شده است.',
    { planItemId: ID },
  ),
};

export const UsageBasedIntervalResponse = {
  description:
    'A validation error, or `usage-based-interval-not-supported` for an interval in operating hours',
  schema: domainErrorSchema(
    'usage-based-interval-not-supported',
    'Usage-Based Interval Not Supported',
    400,
    'برنامه فقط بر اساس روز قابل تعریف است',
    { intervalUnit: { type: 'string', example: 'operating_hours' } },
  ),
};
