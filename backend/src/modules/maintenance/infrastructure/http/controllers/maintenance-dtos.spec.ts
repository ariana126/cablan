import { ClassConstructor, plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';

import { MaintenanceNameDto } from './maintenance-name.dto';
import { AddPmPlanItemDto } from './pm-plan-item/dto/add-pm-plan-item.dto';
import { ChangePmPlanItemIntervalDto } from './pm-plan-item/dto/change-pm-plan-item-interval.dto';
import { RecordMaintenanceExecutionDto } from './pm-plan-item/dto/record-maintenance-execution.dto';

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

    it.each([
      ['missing', undefined],
      ['empty', ''],
      ['blank', ' '.repeat(3)],
      ['not text', 7],
    ])('is refused when %s', async (_label, name) => {
      expect(await invalidFields(MaintenanceNameDto, { name })).toEqual([
        'name',
      ]);
    });
  });

  describe('a PM plan item to add', () => {
    const valid = {
      activityId: 'activity-1',
      intervalValue: 30,
      intervalUnit: 'days',
      firstDueDate: '2026-07-01',
    };

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
      ['intervalUnit', undefined],
      ['intervalUnit', 'weeks'],
      ['firstDueDate', undefined],
      ['firstDueDate', '2026-02-30'],
      ['firstDueDate', '2026-7-1'],
      ['firstDueDate', '2026-07-01T00:00:00Z'],
    ])('is refused with %s = %p', async (field, value) => {
      expect(
        await invalidFields(AddPmPlanItemDto, { ...valid, [field]: value }),
      ).toEqual([field]);
    });
  });

  describe('an interval change', () => {
    it('is accepted for a positive whole number of days', async () => {
      expect(
        await invalidFields(ChangePmPlanItemIntervalDto, { intervalDays: 15 }),
      ).toEqual([]);
    });

    it.each([undefined, 0, -1, 2.5, '15'])(
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

    it('is refused with notes that are not text', async () => {
      expect(
        await invalidFields(RecordMaintenanceExecutionDto, { notes: 7 }),
      ).toEqual(['notes']);
    });
  });
});
