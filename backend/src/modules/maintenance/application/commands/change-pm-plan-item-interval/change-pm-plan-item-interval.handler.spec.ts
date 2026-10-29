import { EntityNotFound, Identity } from '@framework/domain';
import { tehranMorningOf } from '@maintenance/application/support/fixed-clock';
import { MaintenanceWorld } from '@maintenance/application/support/maintenance-world';
import { PmPlanItemIntervalChanged } from '@maintenance/domain/events/pm-plan-item-interval-changed.event';
import { PmPlanItemIsRemoved } from '@maintenance/domain/exceptions/pm-plan-item-is-removed.exception';
import { PmOccurrences } from '@maintenance/domain/pm-occurrences';
import { CalendarDate } from '@maintenance/domain/value/calendar-date.vo';
import { PmOccurrenceStatus } from '@maintenance/domain/value/pm-occurrence-status';

import { ChangePmPlanItemIntervalCommand } from './change-pm-plan-item-interval.command';
import { ChangePmPlanItemIntervalHandler } from './change-pm-plan-item-interval.handler';

const date = (value: string) => CalendarDate.fromString(value);

// Oil change on the extruder, first due 07/01, every 30 days.
function makeSut(today: string) {
  const world = new MaintenanceWorld(today);
  const sut = new ChangePmPlanItemIntervalHandler(
    world.equipmentRepository,
    world.executionRepository,
    world.clock,
  );
  const extruder = world.equipment('اکسترودر');
  const item = world.planItem(
    extruder,
    world.activity('تعویض روغن'),
    30,
    '2026-07-01',
  );
  const change = (intervalDays: number) =>
    sut.execute(
      new ChangePmPlanItemIntervalCommand(extruder.id, item.id, intervalDays),
    );
  return { world, sut, extruder, item, change };
}

async function dueDatesOf(world: MaintenanceWorld, through: string) {
  const [equipment] = await world.equipmentRepository.list();
  const [item] = equipment.activePlanItems();
  return item
    .schedule()
    .dueDatesThrough(date(through))
    .map((due) => due.asString());
}

describe('ChangePmPlanItemIntervalHandler', () => {
  it('restarts the schedule from today’s Tehran occurrence (30 → 15 on 07/10 after due 07/01)', async () => {
    const { world, extruder, item, change } = makeSut('2026-07-10');
    world.executed(extruder, item, '2026-07-01', tehranMorningOf('2026-07-01'));

    await change(15);

    expect(await dueDatesOf(world, '2026-07-31')).toEqual([
      '2026-07-01',
      '2026-07-16',
      '2026-07-31',
    ]);
    expect(world.equipmentRepository.savedEvents).toEqual([
      new PmPlanItemIntervalChanged(
        extruder.id.asString(),
        'اکسترودر',
        item.id.asString(),
        'تعویض روغن',
        30,
        15,
        '2026-07-01',
      ),
    ]);
  });

  it('restarts from the latest occurrence already done, so an early execution keeps its due date', async () => {
    // Recorded on 07/01 and again on 07/02 (for 07/31); changed to 20 on 07/05.
    const { world, extruder, item, change } = makeSut('2026-07-05');
    world.executed(extruder, item, '2026-07-01', tehranMorningOf('2026-07-01'));
    const early = world.executed(
      extruder,
      item,
      '2026-07-31',
      tehranMorningOf('2026-07-02'),
    );

    await change(20);

    expect(await dueDatesOf(world, '2026-08-20')).toEqual([
      '2026-07-01',
      '2026-07-31',
      '2026-08-20',
    ]);
    const [equipment] = await world.equipmentRepository.list();
    const [saved] = equipment.activePlanItems();
    const occurrences = new PmOccurrences(
      saved.schedule(),
      world.executionRepository.all(),
    );
    const july31 = occurrences.occurrenceOn(
      date('2026-07-31'),
      date('2026-07-05'),
    );
    expect(july31.execution).toBe(early);
    expect(july31.status).toBe(PmOccurrenceStatus.OnTime);
  });

  it('refuses a removed item', async () => {
    const { extruder, item, change } = makeSut('2026-07-10');
    extruder.removePlanItem(item.id, tehranMorningOf('2026-07-05'));

    await expect(change(15)).rejects.toBeInstanceOf(PmPlanItemIsRemoved);
  });

  it('refuses unknown equipment', async () => {
    const { sut, item } = makeSut('2026-07-10');

    await expect(
      sut.execute(
        new ChangePmPlanItemIntervalCommand(Identity.new(), item.id, 15),
      ),
    ).rejects.toBeInstanceOf(EntityNotFound);
  });
});
