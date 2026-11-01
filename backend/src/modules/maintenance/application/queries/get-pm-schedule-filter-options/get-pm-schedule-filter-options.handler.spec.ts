import { Identity } from '@framework/domain';
import { tehranMorningOf } from '@maintenance/application/support/fixed-clock';
import { MaintenanceWorld } from '@maintenance/application/support/maintenance-world';

import { GetPmScheduleFilterOptionsHandler } from './get-pm-schedule-filter-options.handler';

function makeSut() {
  const world = new MaintenanceWorld('2026-07-20');
  const sut = new GetPmScheduleFilterOptionsHandler(
    world.equipmentRepository,
    world.activityRepository,
    world.executionRepository,
  );
  return { world, sut };
}

describe('GetPmScheduleFilterOptionsHandler', () => {
  it('offers every piece of equipment by name, retired included and flagged', async () => {
    const { world, sut } = makeSut();
    const press = world.equipment('پرس');
    const extruder = world.equipment('اکسترودر');
    const mixer = world.equipment('بالمیکسر');
    press.retire(world.clock.now());

    const { equipment } = await sut.execute();

    expect(equipment).toEqual([
      { id: extruder.id.asString(), name: 'اکسترودر', retired: false },
      { id: mixer.id.asString(), name: 'بالمیکسر', retired: false },
      { id: press.id.asString(), name: 'پرس', retired: true },
    ]);
  });

  it('offers the whole activity catalog by name', async () => {
    const { world, sut } = makeSut();
    const greasing = world.activity('گریس کاری');
    const oilChange = world.activity('تعویض روغن');

    const { activities } = await sut.execute();

    expect(activities).toEqual([
      { id: oilChange.id.asString(), name: 'تعویض روغن' },
      { id: greasing.id.asString(), name: 'گریس کاری' },
    ]);
  });

  it('offers each performer once, by the name of their latest execution, by name', async () => {
    const { world, sut } = makeSut();
    const extruder = world.equipment('اکسترودر');
    const item = world.planItem(
      extruder,
      world.activity('تعویض روغن'),
      7,
      '2026-07-01',
    );
    const moslemi = Identity.new();
    const rezazadeh = Identity.new();
    const record = (dueDate: string, name: string, performer: Identity) =>
      world.executed(
        extruder,
        item,
        dueDate,
        tehranMorningOf(dueDate),
        name,
        null,
        performer,
      );
    record('2026-07-08', 'محمد مسلمی', moslemi);
    record('2026-07-01', 'مسلمی', moslemi);
    record('2026-07-15', 'رضازاده', rezazadeh);

    const { performers } = await sut.execute();

    expect(performers).toEqual([
      { id: rezazadeh.asString(), name: 'رضازاده' },
      { id: moslemi.asString(), name: 'محمد مسلمی' },
    ]);
  });

  it('offers nothing when nothing is registered', async () => {
    const { sut } = makeSut();

    expect(await sut.execute()).toEqual({
      equipment: [],
      activities: [],
      performers: [],
    });
  });
});
