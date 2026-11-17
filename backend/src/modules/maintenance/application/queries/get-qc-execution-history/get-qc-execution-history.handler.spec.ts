import { Identity } from '@framework/domain';
import { InvalidQcExecutionRange } from '@maintenance/application/exceptions';
import { QcExecutionCriteria } from '@maintenance/application/service/qc-execution-filter';
import {
  MaintenanceWorld,
  NIKROOZ,
} from '@maintenance/application/support/maintenance-world';
import { EquipmentName } from '@maintenance/domain/value/equipment-name.vo';

import { GetQcExecutionHistoryHandler } from './get-qc-execution-history.handler';
import { GetQcExecutionHistoryQuery } from './get-qc-execution-history.query';

// A time of day in Tehran (UTC+03:30) on Jalali 1405/07/01–03, which are
// 2026-09-23–25.
const GREGORIAN_DAY = { '01': '23', '02': '24', '03': '25' } as const;
const at = (day: keyof typeof GREGORIAN_DAY, time: string) =>
  new Date(`2026-09-${GREGORIAN_DAY[day]}T${time}:00.000+03:30`);

const all: QcExecutionCriteria = {
  from: null,
  to: null,
  equipmentId: null,
  activityId: null,
  performedById: null,
  trackingNumber: null,
};

function makeSut() {
  const world = new MaintenanceWorld('2026-09-25');
  const sut = new GetQcExecutionHistoryHandler(world.qcExecutionReader);
  const first = world.equipment('اکسترودر 1');
  const second = world.equipment('اکسترودر 2');
  const dimensional = world.qcActivity('بازرسی ابعادی');
  const visual = world.qcActivity('بازرسی ظاهری');
  world.qcAssigned(first, dimensional, visual);
  world.qcAssigned(second, dimensional, visual);
  return { world, sut, first, second, dimensional, visual };
}

describe('GetQcExecutionHistoryHandler', () => {
  it('measures each record from the previous one of the same activity on the same equipment only, newest first', async () => {
    const { world, sut, first, second, dimensional, visual } = makeSut();
    world.qcRecorded(first, dimensional, at('01', '08:00'));
    world.qcRecorded(first, visual, at('01', '09:00'));
    world.qcRecorded(second, dimensional, at('01', '09:30'), {
      trackingNumber: 'TR-200',
    });
    world.qcRecorded(first, dimensional, at('01', '10:00'), {
      trackingNumber: 'TR-101',
    });

    const { executions } = await sut.execute(
      new GetQcExecutionHistoryQuery(all),
    );

    expect(
      executions.map((execution) => [
        execution.activityName,
        execution.equipmentName,
        execution.performedAt,
        execution.previousPerformedAt,
        execution.intervalMinutes,
      ]),
    ).toEqual([
      [
        'بازرسی ابعادی',
        'اکسترودر 1',
        at('01', '10:00').toISOString(),
        at('01', '08:00').toISOString(),
        120,
      ],
      [
        'بازرسی ابعادی',
        'اکسترودر 2',
        at('01', '09:30').toISOString(),
        null,
        null,
      ],
      [
        'بازرسی ظاهری',
        'اکسترودر 1',
        at('01', '09:00').toISOString(),
        null,
        null,
      ],
      [
        'بازرسی ابعادی',
        'اکسترودر 1',
        at('01', '08:00').toISOString(),
        null,
        null,
      ],
    ]);
  });

  it('carries everything a record says', async () => {
    const { world, sut, first, dimensional } = makeSut();
    const record = world.qcRecorded(first, dimensional, at('01', '08:00'), {
      notes: 'خراش جزئی روی روکش',
    });

    const { executions } = await sut.execute(
      new GetQcExecutionHistoryQuery(all),
    );

    expect(executions).toEqual([
      {
        id: record.id.asString(),
        equipmentId: first.id.asString(),
        equipmentName: 'اکسترودر 1',
        activityId: dimensional.id.asString(),
        activityName: 'بازرسی ابعادی',
        performedById: NIKROOZ.id.asString(),
        performedByName: 'نیکروش',
        performedAt: at('01', '08:00').toISOString(),
        trackingNumber: 'TR-100',
        notes: 'خراش جزئی روی روکش',
        previousPerformedAt: null,
        intervalMinutes: null,
      },
    ]);
  });

  it('measures the interval to the minute', async () => {
    const { world, sut, first, dimensional } = makeSut();
    world.qcRecorded(first, dimensional, at('01', '08:00'));
    world.qcRecorded(first, dimensional, at('02', '11:20'));

    const { executions } = await sut.execute(
      new GetQcExecutionHistoryQuery(all),
    );

    expect(executions[0].intervalMinutes).toBe(1640);
  });

  it('keeps a record’s interval from a previous one the range leaves out', async () => {
    const { world, sut, first, dimensional } = makeSut();
    world.qcRecorded(first, dimensional, at('01', '08:00'));
    world.qcRecorded(first, dimensional, at('01', '10:00'));

    const { executions } = await sut.execute(
      new GetQcExecutionHistoryQuery({
        ...all,
        from: at('01', '09:00'),
        to: at('01', '23:59'),
      }),
    );

    expect(executions).toHaveLength(1);
    expect(executions[0].intervalMinutes).toBe(120);
  });

  it('counts the records of each activity on each piece of equipment the filters admit, by equipment then activity name', async () => {
    const { world, sut, first, dimensional, visual } = makeSut();
    world.qcRecorded(first, dimensional, at('01', '08:00'));
    world.qcRecorded(first, dimensional, at('02', '08:00'), {
      trackingNumber: 'TR-101',
    });
    world.qcRecorded(first, dimensional, at('03', '08:00'), {
      trackingNumber: 'TR-101',
    });
    world.qcRecorded(first, visual, at('02', '09:00'), {
      trackingNumber: 'TR-101',
    });

    const { counts } = await sut.execute(
      new GetQcExecutionHistoryQuery({
        ...all,
        from: at('02', '00:00'),
        to: at('03', '23:59'),
        trackingNumber: 'TR-101',
      }),
    );

    expect(counts).toEqual([
      {
        equipmentId: first.id.asString(),
        equipmentName: 'اکسترودر 1',
        activityId: dimensional.id.asString(),
        activityName: 'بازرسی ابعادی',
        count: 2,
      },
      {
        equipmentId: first.id.asString(),
        equipmentName: 'اکسترودر 1',
        activityId: visual.id.asString(),
        activityName: 'بازرسی ظاهری',
        count: 1,
      },
    ]);
  });

  it('orders the counts by equipment name first', async () => {
    const { world, sut, first, second, dimensional, visual } = makeSut();
    world.qcRecorded(second, dimensional, at('01', '08:00'));
    world.qcRecorded(first, visual, at('01', '09:00'));

    const { counts } = await sut.execute(new GetQcExecutionHistoryQuery(all));

    expect(counts.map((count) => count.equipmentName)).toEqual([
      'اکسترودر 1',
      'اکسترودر 2',
    ]);
  });

  it('shows the equipment’s current name', async () => {
    const { world, sut, first, dimensional } = makeSut();
    world.qcRecorded(first, dimensional, at('01', '08:00'));
    first.correctName(EquipmentName.fromString('اکسترودر خط یک'));

    const { executions, counts } = await sut.execute(
      new GetQcExecutionHistoryQuery(all),
    );

    expect(executions[0].equipmentName).toBe('اکسترودر خط یک');
    expect(counts[0].equipmentName).toBe('اکسترودر خط یک');
  });

  it('reads nothing and counts nothing when no record matches', async () => {
    const { world, sut, first, dimensional } = makeSut();
    world.qcRecorded(first, dimensional, at('01', '08:00'));

    expect(
      await sut.execute(
        new GetQcExecutionHistoryQuery({
          ...all,
          performedById: Identity.new(),
        }),
      ),
    ).toEqual({ executions: [], counts: [] });
  });

  it('refuses a range starting after it ends', async () => {
    const { sut } = makeSut();

    await expect(
      sut.execute(
        new GetQcExecutionHistoryQuery({
          ...all,
          from: at('02', '00:00'),
          to: at('01', '00:00'),
        }),
      ),
    ).rejects.toBeInstanceOf(InvalidQcExecutionRange);
  });
});
