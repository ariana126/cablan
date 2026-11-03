import { ClassConstructor, plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';

import { CompleteMissingSpecialtiesDto } from './maintenance-activity/dto/complete-missing-specialties.dto';
import { MaintenanceActivityDto } from './maintenance-activity/dto/maintenance-activity.dto';
import { MaintenanceNameDto } from './maintenance-name.dto';
import { PmDashboardQueryDto } from './pm-dashboard/dto/pm-dashboard-query.dto';
import { AddPmPlanItemDto } from './pm-plan-item/dto/add-pm-plan-item.dto';
import { ChangePmPlanItemIntervalDto } from './pm-plan-item/dto/change-pm-plan-item-interval.dto';
import { RecordMaintenanceExecutionDto } from './pm-plan-item/dto/record-maintenance-execution.dto';
import { PmScheduleRangeQueryDto } from './pm-schedule/dto/pm-schedule-range-query.dto';

async function invalidFields<T extends object>(
  dto: ClassConstructor<T>,
  body: Record<string, unknown>,
): Promise<string[]> {
  const errors = await validate(plainToInstance(dto, body), {
    whitelist: true,
    forbidNonWhitelisted: true,
  });
  return errors.map((error) => error.property);
}

describe('maintenance request bodies', () => {
  describe('a name (equipment or activity)', () => {
    it('is accepted, trimmed', async () => {
      expect(
        await invalidFields(MaintenanceNameDto, { name: ' پرس ' }),
      ).toEqual([]);
      expect(plainToInstance(MaintenanceNameDto, { name: ' پرس ' }).name).toBe(
        'پرس',
      );
    });

    it('is accepted up to 200 characters', async () => {
      expect(
        await invalidFields(MaintenanceNameDto, { name: 'ن'.repeat(200) }),
      ).toEqual([]);
    });

    it.each([
      ['missing', undefined],
      ['empty', ''],
      ['blank', ' '.repeat(3)],
      ['not text', 7],
      ['longer than 200 characters', 'ن'.repeat(201)],
    ])('is refused when %s', async (_label, name) => {
      expect(await invalidFields(MaintenanceNameDto, { name })).toEqual([
        'name',
      ]);
    });
  });

  describe('an activity (to register or edit)', () => {
    it.each(['electrical', 'mechanical'])(
      'is accepted with the specialty %p',
      async (specialty) => {
        expect(
          await invalidFields(MaintenanceActivityDto, {
            name: 'تعویض روغن',
            specialty,
          }),
        ).toEqual([]);
      },
    );

    it.each([
      ['missing', undefined],
      ['empty', ''],
      ['not one of the two', 'civil'],
      ['both at once', ['electrical', 'mechanical']],
      ['not text', 1],
    ])('is refused when its specialty is %s', async (_label, specialty) => {
      expect(
        await invalidFields(MaintenanceActivityDto, {
          name: 'تعویض روغن',
          specialty,
        }),
      ).toEqual(['specialty']);
    });

    it('still validates its name', async () => {
      expect(
        await invalidFields(MaintenanceActivityDto, {
          name: ' ',
          specialty: 'mechanical',
        }),
      ).toEqual(['name']);
    });
  });

  describe('the completion of the missing specialties', () => {
    const uuid = '550e8400-e29b-41d4-a716-446655440000';

    it('is accepted naming activities by id with a specialty each, or none', async () => {
      expect(
        await invalidFields(CompleteMissingSpecialtiesDto, {
          assignments: [{ activityId: uuid, specialty: 'electrical' }],
        }),
      ).toEqual([]);
      expect(
        await invalidFields(CompleteMissingSpecialtiesDto, { assignments: [] }),
      ).toEqual([]);
    });

    it.each([
      ['missing', undefined],
      ['not a list', { activityId: uuid, specialty: 'electrical' }],
      ['an entry without a specialty', [{ activityId: uuid }]],
      [
        'an entry with an unknown specialty',
        [{ activityId: uuid, specialty: 'civil' }],
      ],
      [
        'an entry not naming an activity by id',
        [{ activityId: 'oil', specialty: 'electrical' }],
      ],
    ])('is refused with assignments %s', async (_label, assignments) => {
      expect(
        await invalidFields(CompleteMissingSpecialtiesDto, { assignments }),
      ).toEqual(['assignments']);
    });
  });

  describe('a PM plan item to add', () => {
    const valid = {
      activityId: 'activity-1',
      intervalValue: 30,
      intervalUnit: 'days',
      firstDueDate: '2026-07-01',
    };

    it.each([
      ['intervalValue', 36_500],
      ['firstDueDate', '2000-01-01'],
      ['firstDueDate', '2100-12-31'],
    ])('is accepted with %s = %p, at its bound', async (field, value) => {
      expect(
        await invalidFields(AddPmPlanItemDto, { ...valid, [field]: value }),
      ).toEqual([]);
    });

    it('is accepted in days, and in operating hours (the domain refuses those)', async () => {
      expect(await invalidFields(AddPmPlanItemDto, valid)).toEqual([]);
      expect(
        await invalidFields(AddPmPlanItemDto, {
          ...valid,
          intervalUnit: 'operating_hours',
        }),
      ).toEqual([]);
    });

    it.each([
      ['activityId', undefined],
      ['activityId', ''],
      ['intervalValue', undefined],
      ['intervalValue', 0],
      ['intervalValue', -7],
      ['intervalValue', 1.5],
      ['intervalValue', 36_501],
      ['intervalUnit', undefined],
      ['intervalUnit', 'weeks'],
      ['firstDueDate', undefined],
      ['firstDueDate', '2026-02-30'],
      ['firstDueDate', '2026-7-1'],
      ['firstDueDate', '2026-07-01T00:00:00Z'],
      ['firstDueDate', '1999-12-31'],
      ['firstDueDate', '2101-01-01'],
    ])('is refused with %s = %p', async (field, value) => {
      expect(
        await invalidFields(AddPmPlanItemDto, { ...valid, [field]: value }),
      ).toEqual([field]);
    });
  });

  describe('an interval change', () => {
    it.each([15, 36_500])(
      'is accepted for %p days, a whole number from 1 to 36500',
      async (intervalDays) => {
        expect(
          await invalidFields(ChangePmPlanItemIntervalDto, { intervalDays }),
        ).toEqual([]);
      },
    );

    it.each([undefined, 0, -1, 2.5, '15', 36_501])(
      'is refused for %p',
      async (intervalDays) => {
        expect(
          await invalidFields(ChangePmPlanItemIntervalDto, { intervalDays }),
        ).toEqual(['intervalDays']);
      },
    );
  });

  describe('an execution', () => {
    it('is accepted with or without notes', async () => {
      expect(await invalidFields(RecordMaintenanceExecutionDto, {})).toEqual(
        [],
      );
      expect(
        await invalidFields(RecordMaintenanceExecutionDto, {
          notes: 'انجام شد',
        }),
      ).toEqual([]);
    });

    it('is accepted with notes up to 2000 characters', async () => {
      expect(
        await invalidFields(RecordMaintenanceExecutionDto, {
          notes: 'ن'.repeat(2000),
        }),
      ).toEqual([]);
    });

    it.each([
      ['not text', 7],
      ['longer than 2000 characters', 'ن'.repeat(2001)],
    ])('is refused with notes %s', async (_label, notes) => {
      expect(
        await invalidFields(RecordMaintenanceExecutionDto, { notes }),
      ).toEqual(['notes']);
    });
  });

  describe('an execution’s operating hours', () => {
    it.each([0, 1250.5, 12.25, 1_000_000])(
      'are accepted as %p',
      async (operatingHours) => {
        expect(
          await invalidFields(RecordMaintenanceExecutionDto, {
            operatingHours,
          }),
        ).toEqual([]);
      },
    );

    it('are left out when null, as when absent', async () => {
      expect(
        await invalidFields(RecordMaintenanceExecutionDto, {
          operatingHours: null,
        }),
      ).toEqual([]);
      expect(
        plainToInstance(RecordMaintenanceExecutionDto, {
          operatingHours: null,
        }).operatingHours,
      ).toBeUndefined();
    });

    it.each([
      ['negative', -1],
      ['over a million', 1_000_000.01],
      ['with three decimals', 1.234],
      ['text', '12'],
      ['not a finite number', Number.NaN],
      ['infinite', Number.POSITIVE_INFINITY],
      ['tiny, written with an exponent', 1e-7],
      ['tiny, with a mantissa', 1.5e-7],
      ['huge, written with an exponent', 1e21],
    ])('are refused when %s', async (_label, operatingHours) => {
      expect(
        await invalidFields(RecordMaintenanceExecutionDto, { operatingHours }),
      ).toEqual(['operatingHours']);
    });
  });

  describe('a PM schedule range and its filters', () => {
    const uuid = '550e8400-e29b-41d4-a716-446655440000';

    it('is accepted with every filter', async () => {
      expect(
        await invalidFields(PmScheduleRangeQueryDto, {
          from: '2026-07-01',
          to: '2026-07-31',
          equipmentId: uuid,
          activityId: uuid,
          status: 'late',
          specialty: 'electrical',
          performedById: uuid,
        }),
      ).toEqual([]);
    });

    // A missing or reversed bound is `invalid-pm-schedule-range`, refused by
    // the handler, not a validation error.
    it('is accepted without a start, an end, or with them reversed', async () => {
      expect(await invalidFields(PmScheduleRangeQueryDto, {})).toEqual([]);
      expect(
        await invalidFields(PmScheduleRangeQueryDto, {
          from: '2026-07-31',
          to: '2026-07-01',
        }),
      ).toEqual([]);
    });

    // An empty bound (`?from=&to=…`) is a missing one, so it reaches the
    // handler's `invalid-pm-schedule-range` instead of a validation error.
    it.each(['from', 'to'])('reads an empty %s as missing', async (field) => {
      expect(
        await invalidFields(PmScheduleRangeQueryDto, { [field]: '' }),
      ).toEqual([]);
      expect(
        plainToInstance(PmScheduleRangeQueryDto, { [field]: '' })[
          field as 'from' | 'to'
        ],
      ).toBeUndefined();
    });

    it.each([
      ['from', '2000-01-01'],
      ['to', '2100-12-31'],
    ])('is accepted with %s = %p, at its bound', async (field, value) => {
      expect(
        await invalidFields(PmScheduleRangeQueryDto, { [field]: value }),
      ).toEqual([]);
    });

    it.each([
      ['from', '2026-02-30'],
      ['from', '1405/08/01'],
      ['from', '0001-01-01'],
      ['from', '1999-12-31'],
      ['to', '2026-7-1'],
      ['to', '2101-01-01'],
      ['to', '9999-12-31'],
      ['equipmentId', 'not-a-uuid'],
      ['activityId', 'not-a-uuid'],
      ['status', 'done'],
      ['specialty', 'civil'],
      ['specialty', ''],
      ['performedById', ''],
    ])('is refused with %s = %p', async (field, value) => {
      expect(
        await invalidFields(PmScheduleRangeQueryDto, { [field]: value }),
      ).toEqual([field]);
    });
  });

  describe('the technical management dashboard’s period and equipment', () => {
    it('defaults to the last 30 days of every piece of equipment', async () => {
      expect(await invalidFields(PmDashboardQueryDto, {})).toEqual([]);
      expect(plainToInstance(PmDashboardQueryDto, {}).periodDays).toBe(30);
    });

    it.each(['7', '30', '90'])(
      'is accepted for the last %s days, read as a number',
      async (periodDays) => {
        expect(
          await invalidFields(PmDashboardQueryDto, { periodDays }),
        ).toEqual([]);
        expect(
          plainToInstance(PmDashboardQueryDto, { periodDays }).periodDays,
        ).toBe(Number(periodDays));
      },
    );

    it('is accepted for one piece of equipment', async () => {
      expect(
        await invalidFields(PmDashboardQueryDto, {
          equipmentId: '550e8400-e29b-41d4-a716-446655440000',
        }),
      ).toEqual([]);
    });

    it.each([
      ['periodDays', '14'],
      ['periodDays', ''],
      ['periodDays', 'month'],
      ['periodDays', '7.5'],
      ['equipmentId', 'not-a-uuid'],
    ])('is refused with %s = %p', async (field, value) => {
      expect(
        await invalidFields(PmDashboardQueryDto, { [field]: value }),
      ).toEqual([field]);
    });
  });
});
