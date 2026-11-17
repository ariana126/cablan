import { domainErrorSchema } from '@framework/infrastructure';

// The OpenAPI shapes of production QC's read models and problems (issue
// #119). Field names are the plan's
// (docs/superpowers/plans/2026-11-16-production-qc.md).

const ID = { type: 'string', example: '550e8400-e29b-41d4-a716-446655440000' };
const INSTANT = {
  type: 'string',
  format: 'date-time',
  example: '2026-09-23T04:30:00.000Z',
};
const NULLABLE_INSTANT = { ...INSTANT, nullable: true };
const EQUIPMENT_NAME = { type: 'string', example: 'اکسترودر 1' };
const ACTIVITY_NAME = { type: 'string', example: 'بازرسی ابعادی' };
const IDS = { equipmentId: ID, activityId: ID };

export const QcActivitySchema = {
  properties: {
    id: ID,
    name: ACTIVITY_NAME,
    assignedEquipmentCount: {
      type: 'integer',
      minimum: 0,
      example: 2,
      description: 'Equipment it is assigned to, retired included',
    },
  },
};

export const QcEquipmentSummarySchema = {
  properties: {
    id: ID,
    name: EQUIPMENT_NAME,
    retired: { type: 'boolean', example: false },
    assignedActivityCount: { type: 'integer', minimum: 0, example: 2 },
  },
};

export const QcActivityStatusSchema = {
  properties: {
    activityId: ID,
    activityName: { ...ACTIVITY_NAME, description: 'Its current name' },
    lastPerformedAt: {
      ...NULLABLE_INSTANT,
      description:
        'Its latest record on this equipment, ever; null when it has none («بدون سابقه»)',
    },
  },
};

export const QcEquipmentSchema = {
  properties: {
    id: ID,
    name: { ...EQUIPMENT_NAME, description: 'Its current name' },
    retired: { type: 'boolean', example: false },
    activities: {
      type: 'array',
      description: 'The QC activities assigned to it now, by name',
      items: QcActivityStatusSchema,
    },
  },
};

export const QcExecutionSchema = {
  properties: {
    id: ID,
    equipmentId: ID,
    equipmentName: { ...EQUIPMENT_NAME, description: 'Its current name' },
    activityId: ID,
    activityName: { ...ACTIVITY_NAME, description: 'Its current name' },
    performedById: ID,
    performedByName: { type: 'string', example: 'نیکروش' },
    performedAt: INSTANT,
    trackingNumber: { type: 'string', example: 'TR-100' },
    notes: { type: 'string', nullable: true, example: 'خراش جزئی روی روکش' },
    previousPerformedAt: {
      ...NULLABLE_INSTANT,
      description:
        'The previous record of the same equipment and activity, over every record whatever the filters; null for the first',
    },
    intervalMinutes: {
      type: 'integer',
      nullable: true,
      minimum: 0,
      example: 1640,
      description:
        'Whole minutes since that previous record, floored; null for the first',
    },
  },
};

export const QcExecutionCountSchema = {
  properties: {
    ...IDS,
    equipmentName: EQUIPMENT_NAME,
    activityName: ACTIVITY_NAME,
    count: { type: 'integer', minimum: 1, example: 2 },
  },
};

export const QcExecutionHistorySchema = {
  properties: {
    executions: {
      type: 'array',
      description: 'Newest first',
      items: QcExecutionSchema,
    },
    counts: {
      type: 'array',
      description:
        'Records per activity per equipment among those the filters admit, by equipment then activity name',
      items: QcExecutionCountSchema,
    },
  },
};

const NAMED_OPTION = { properties: { id: ID, name: { type: 'string' } } };

export const QcExecutionFilterOptionsSchema = {
  properties: {
    equipment: {
      type: 'array',
      items: {
        properties: {
          id: ID,
          name: EQUIPMENT_NAME,
          retired: { type: 'boolean', example: false },
        },
      },
    },
    activities: { type: 'array', items: NAMED_OPTION },
    performers: { type: 'array', items: NAMED_OPTION },
  },
};

export const QcActivityNameTakenSchema = domainErrorSchema(
  'qc-activity-name-taken',
  'QC Activity Name Taken',
  409,
  'فعالیت QC با این عنوان قبلا تعریف شده است.',
  { name: ACTIVITY_NAME },
);

export const QcActivityNotFoundSchema = domainErrorSchema(
  'qc-activity-not-found',
  'QC Activity Not Found',
  404,
  'فعالیت QC پیدا نشد.',
  { activityId: ID },
);

export const EquipmentNotFoundSchema = domainErrorSchema(
  'equipment-not-found',
  'Equipment Not Found',
  404,
  'تجهیز پیدا نشد.',
  { equipmentId: ID },
);

export const QcExecutionNotFoundSchema = domainErrorSchema(
  'qc-execution-not-found',
  'QC Execution Not Found',
  404,
  'سابقه انجام QC پیدا نشد.',
  { executionId: ID },
);

export const QcActivityAlreadyAssignedSchema = domainErrorSchema(
  'qc-activity-already-assigned',
  'QC Activity Already Assigned',
  409,
  '"بازرسی ابعادی" قبلا به "اکسترودر 1" تخصیص داده شده است.',
  IDS,
);

export const QcActivityNotAssignedSchema = domainErrorSchema(
  'qc-activity-not-assigned',
  'QC Activity Not Assigned',
  409,
  '"بازرسی ابعادی" به "اکسترودر 1" تخصیص داده نشده است.',
  IDS,
);

export const QcEquipmentRetiredSchema = domainErrorSchema(
  'equipment-retired',
  'Equipment Retired',
  409,
  '"اکسترودر 1" کنار گذاشته شده است.',
  { equipmentId: ID },
);
