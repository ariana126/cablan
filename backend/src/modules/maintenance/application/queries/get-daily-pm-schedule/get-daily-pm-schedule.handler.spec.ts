import { PmPlanReader } from '@maintenance/application/service/pm-plan-reader';
import { tehranMorningOf } from '@maintenance/application/support/fixed-clock';
import { MaintenanceWorld } from '@maintenance/application/support/maintenance-world';

import { DailyPmTaskReadModel } from './daily-pm-task.read-model';
import { GetDailyPmScheduleHandler } from './get-daily-pm-schedule.handler';

function makeSut(today: string) {
  const world = new MaintenanceWorld(today);
  const sut = new GetDailyPmScheduleHandler(
    world.equipmentRepository,
    new PmPlanReader(
      world.activityRepository,
      world.executionRepository,
      world.clock,
    ),
  );
  return { world, sut };
}

describe('GetDailyPmScheduleHandler', () => {
  it('lists the work due today and overdue, not the work ahead', async () => {
    const { world, sut } = makeSut('2026-07-10');
    const extruder = world.equipment('اکسترودر');
    const oilChange = world.activity('تعویض روغن');
    const greasing = world.activity('گریس کاری');
    const inspection = world.activity('بازدید');
    const dueToday = world.planItem(extruder, oilChange, 30, '2026-07-10');
    const overdue = world.planItem(extruder, greasing, 7, '2026-07-07');
    world.planItem(extruder, inspection, 7, '2026-07-12');

    expect(await sut.execute()).toEqual([
      new DailyPmTaskReadModel(
        extruder.id.asString(),
        'اکسترودر',
        dueToday.id.asString(),
        oilChange.id.asString(),
        'تعویض روغن',
        '2026-07-10',
        'due',
        0,
      ),
      new DailyPmTaskReadModel(
        extruder.id.asString(),
        'اکسترودر',
        overdue.id.asString(),
        greasing.id.asString(),
        'گریس کاری',
        '2026-07-07',
        'overdue',
        3,
      ),
    ]);
  });

  it('drops work done today (an oil change done today)', async () => {
    const { world, sut } = makeSut('2026-07-10');
    const extruder = world.equipment('اکسترودر');
    const item = world.planItem(
      extruder,
      world.activity('تعویض روغن'),
      30,
      '2026-07-10',
    );
    world.executed(extruder, item, '2026-07-10', world.clock.now());

    expect(await sut.execute()).toEqual([]);
  });

  it('shows the last overdue day before the next occurrence, then only the next occurrence once reached', async () => {
    const { world, sut } = makeSut('2026-07-07');
    const extruder = world.equipment('اکسترودر');
    world.planItem(extruder, world.activity('تعویض روغن'), 7, '2026-07-01');

    const [lastDay] = await sut.execute();
    expect([lastDay.dueDate, lastDay.status, lastDay.daysOverdue]).toEqual([
      '2026-07-01',
      'overdue',
      6,
    ]);

    world.clock.set(tehranMorningOf('2026-07-08'));
    const rows = await sut.execute();
    expect(
      rows.map((row) => [row.dueDate, row.status, row.daysOverdue]),
    ).toEqual([['2026-07-08', 'due', 0]]);
  });

  it('leaves out removed items and retired equipment', async () => {
    const { world, sut } = makeSut('2026-07-10');
    const extruder = world.equipment('اکسترودر');
    const press = world.equipment('پرس');
    const oilChange = world.activity('تعویض روغن');
    const removed = world.planItem(extruder, oilChange, 7, '2026-07-10');
    extruder.removePlanItem(removed.id, world.clock.now());
    world.planItem(press, oilChange, 7, '2026-07-10');
    press.retire(world.clock.now());

    expect(await sut.execute()).toEqual([]);
  });

  it('orders by equipment name, then by the order items were added', async () => {
    const { world, sut } = makeSut('2026-07-10');
    const press = world.equipment('پرس');
    const extruder = world.equipment('اکسترودر');
    const oilChange = world.activity('تعویض روغن');
    const greasing = world.activity('گریس کاری');
    world.planItem(press, oilChange, 7, '2026-07-10');
    world.planItem(extruder, greasing, 7, '2026-07-10');
    world.planItem(extruder, oilChange, 7, '2026-07-09');

    const rows = await sut.execute();
    expect(rows.map((row) => [row.equipmentName, row.activityName])).toEqual([
      ['اکسترودر', 'گریس کاری'],
      ['اکسترودر', 'تعویض روغن'],
      ['پرس', 'تعویض روغن'],
    ]);
  });
});
