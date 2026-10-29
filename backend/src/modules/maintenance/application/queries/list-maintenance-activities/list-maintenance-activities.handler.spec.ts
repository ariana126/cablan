import { MaintenanceWorld } from '@maintenance/application/support/maintenance-world';

import { ListMaintenanceActivitiesHandler } from './list-maintenance-activities.handler';
import { MaintenanceActivityReadModel } from './maintenance-activity.read-model';

describe('ListMaintenanceActivitiesHandler', () => {
  it('lists the catalog by name', async () => {
    const world = new MaintenanceWorld('2026-07-10');
    const oilChange = world.activity('تعویض روغن');
    const greasing = world.activity('گریس کاری');
    const inspection = world.activity('بازدید');
    const sut = new ListMaintenanceActivitiesHandler(world.activityRepository);

    expect(await sut.execute()).toEqual([
      new MaintenanceActivityReadModel(inspection.id.asString(), 'بازدید'),
      new MaintenanceActivityReadModel(oilChange.id.asString(), 'تعویض روغن'),
      new MaintenanceActivityReadModel(greasing.id.asString(), 'گریس کاری'),
    ]);
  });

  it('lists nothing for an empty catalog', async () => {
    const world = new MaintenanceWorld('2026-07-10');
    const sut = new ListMaintenanceActivitiesHandler(world.activityRepository);

    expect(await sut.execute()).toEqual([]);
  });
});
