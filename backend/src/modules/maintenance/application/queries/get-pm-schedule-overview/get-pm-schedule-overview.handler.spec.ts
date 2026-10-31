import { PmPlanReader } from '@maintenance/application/service/pm-plan-reader';
import { tehranMorningOf } from '@maintenance/application/support/fixed-clock';
import { MaintenanceWorld } from '@maintenance/application/support/maintenance-world';

import { GetPmScheduleOverviewHandler } from './get-pm-schedule-overview.handler';
import { PmOccurrenceReadModel } from './pm-occurrence.read-model';

function makeSut(today: string) {
  const world = new MaintenanceWorld(today);
  const sut = new GetPmScheduleOverviewHandler(
    world.equipmentRepository,
    new PmPlanReader(
      world.activityRepository,
      world.executionRepository,
      world.clock,
    ),
  );
  return { world, sut };
}

describe('GetPmScheduleOverviewHandler', () => {
  it('lists every occurrence so far with its status, and who did it when and how late', async () => {
    const { world, sut } = makeSut('2026-07-16');
    const extruder = world.equipment('اکسترودر');
    const item = world.planItem(
      extruder,
      world.activity('تعویض روغن'),
      7,
      '2026-07-01',
    );
    const performedAt = tehranMorningOf('2026-07-09');
    world.executed(extruder, item, '2026-07-08', performedAt, 'مسلمی');

    const row = (dueDate: string, status: string) =>
      new PmOccurrenceReadModel(
        extruder.id.asString(),
        'اکسترودر',
        item.id.asString(),
        'تعویض روغن',
        dueDate,
        status,
        null,
        null,
        null,
      );
    expect(await sut.execute()).toEqual([
      row('2026-07-01', 'missed'),
      new PmOccurrenceReadModel(
        extruder.id.asString(),
        'اکسترودر',
        item.id.asString(),
        'تعویض روغن',
        '2026-07-08',
        'late',
        performedAt.toISOString(),
        'مسلمی',
        1,
      ),
      row('2026-07-15', 'overdue'),
      row('2026-07-22', 'upcoming'),
    ]);
  });

  it('reports how late an occurrence done late was, and null for every other status', async () => {
    const { world, sut } = makeSut('2026-07-16');
    const extruder = world.equipment('اکسترودر');
    const item = world.planItem(
      extruder,
      world.activity('تعویض روغن'),
      7,
      '2026-07-01',
    );
    world.executed(extruder, item, '2026-07-08', tehranMorningOf('2026-07-09'));

    const rows = await sut.execute();
    expect(rows.map((row) => [row.status, row.daysLate])).toEqual([
      ['missed', null],
      ['late', 1],
      ['overdue', null],
      ['upcoming', null],
    ]);
  });

  it('reports no days late for an occurrence done on time', async () => {
    const { world, sut } = makeSut('2026-07-03');
    const extruder = world.equipment('اکسترودر');
    const item = world.planItem(
      extruder,
      world.activity('تعویض روغن'),
      7,
      '2026-07-01',
    );
    world.executed(extruder, item, '2026-07-01', tehranMorningOf('2026-07-01'));

    const rows = await sut.execute();
    expect(rows.map((row) => [row.status, row.daysLate])).toEqual([
      ['on_time', null],
      ['upcoming', null],
    ]);
  });

  it('shows an item whose first due date is ahead as its one upcoming occurrence', async () => {
    const { world, sut } = makeSut('2026-07-01');
    const extruder = world.equipment('اکسترودر');
    world.planItem(extruder, world.activity('تعویض روغن'), 7, '2026-07-08');

    const rows = await sut.execute();
    expect(rows.map((row) => [row.dueDate, row.status])).toEqual([
      ['2026-07-08', 'upcoming'],
    ]);
  });

  it('leaves out removed items and retired equipment', async () => {
    const { world, sut } = makeSut('2026-07-10');
    const extruder = world.equipment('اکسترودر');
    const press = world.equipment('پرس');
    const oilChange = world.activity('تعویض روغن');
    const removed = world.planItem(extruder, oilChange, 7, '2026-07-01');
    extruder.removePlanItem(removed.id, world.clock.now());
    world.planItem(press, oilChange, 7, '2026-07-01');
    press.retire(world.clock.now());

    expect(await sut.execute()).toEqual([]);
  });

  it('orders by equipment name, plan order, then due date', async () => {
    const { world, sut } = makeSut('2026-07-02');
    const press = world.equipment('پرس');
    const extruder = world.equipment('اکسترودر');
    const oilChange = world.activity('تعویض روغن');
    const greasing = world.activity('گریس کاری');
    world.planItem(press, oilChange, 7, '2026-07-01');
    world.planItem(extruder, greasing, 7, '2026-07-02');
    world.planItem(extruder, oilChange, 7, '2026-07-01');

    const rows = await sut.execute();
    expect(
      rows.map((row) => [row.equipmentName, row.activityName, row.dueDate]),
    ).toEqual([
      ['اکسترودر', 'گریس کاری', '2026-07-02'],
      ['اکسترودر', 'گریس کاری', '2026-07-09'],
      ['اکسترودر', 'تعویض روغن', '2026-07-01'],
      ['اکسترودر', 'تعویض روغن', '2026-07-08'],
      ['پرس', 'تعویض روغن', '2026-07-01'],
      ['پرس', 'تعویض روغن', '2026-07-08'],
    ]);
  });
});
