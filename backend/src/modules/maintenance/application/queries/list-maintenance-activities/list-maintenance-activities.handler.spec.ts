import { MaintenanceWorld } from '@maintenance/application/support/maintenance-world';
import { ActivitySpecialty } from '@maintenance/domain/value/activity-specialty.vo';

import { ListMaintenanceActivitiesHandler } from './list-maintenance-activities.handler';
import { MaintenanceActivityReadModel } from './maintenance-activity.read-model';

describe('ListMaintenanceActivitiesHandler', () => {
  it('lists the catalog by name, each with its specialty or none', async () => {
    const world = new MaintenanceWorld('2026-07-10');
    const oilChange = world.activity('تعویض روغن');
    const greasing = world.activityWithoutSpecialty('گریس کاری');
    const inspection = world.activity('بازدید', ActivitySpecialty.electrical());
    const sut = new ListMaintenanceActivitiesHandler(world.activityRepository);

    expect(await sut.execute()).toEqual([
      new MaintenanceActivityReadModel(
        inspection.id.asString(),
        'بازدید',
        'electrical',
      ),
      new MaintenanceActivityReadModel(
        oilChange.id.asString(),
        'تعویض روغن',
        'mechanical',
      ),
      new MaintenanceActivityReadModel(
        greasing.id.asString(),
        'گریس کاری',
        null,
      ),
    ]);
  });

  it('lists nothing for an empty catalog', async () => {
    const world = new MaintenanceWorld('2026-07-10');
    const sut = new ListMaintenanceActivitiesHandler(world.activityRepository);

    expect(await sut.execute()).toEqual([]);
  });
});
