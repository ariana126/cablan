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
      description: 'Items in the PM plan now; removed items excluded',
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

export const EquipmentDetailSchema = {
  properties: {
    ...EquipmentSchema.properties,
    planItems: { type: 'array', items: PmPlanItemSchema },
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
    planItemId: ID,
    activityName: { type: 'string', example: 'تعویض روغن' },
    dueDate: DATE,
    status: {
      type: 'string',
      enum: ['on_time', 'late', 'missed', 'overdue', 'due', 'upcoming'],
    },
    performedAt: { ...INSTANT, nullable: true },
    performedBy: { type: 'string', nullable: true, example: 'مسلمی' },
    daysLate: DAYS_LATE,
  },
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
    '`activity-already-in-pm-plan`, `equipment-retired`, `pm-plan-item-removed` or `pm-occurrence-already-recorded`',
  schema: domainErrorSchema(
    'pm-plan-item-removed',
    'PM Plan Item Removed',
    409,
    'این فعالیت از برنامه تجهیز حذف شده است',
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
