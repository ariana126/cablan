import { EntityNotFound, Identity } from '@framework/domain';
import { MaintenanceActivityNameTaken } from '@maintenance/application/exceptions';
import { InMemoryMaintenanceActivityRepository } from '@maintenance/application/support/in-memory-maintenance-activity-repository';
import { MaintenanceActivity } from '@maintenance/domain/maintenance-activity.aggregate';
import { MaintenanceActivityName } from '@maintenance/domain/value/maintenance-activity-name.vo';

import { RenameMaintenanceActivityCommand } from './rename-maintenance-activity.command';
import { RenameMaintenanceActivityHandler } from './rename-maintenance-activity.handler';

const name = (value: string) => MaintenanceActivityName.fromString(value);

function makeSut() {
  const activityRepository = new InMemoryMaintenanceActivityRepository();
  const sut = new RenameMaintenanceActivityHandler(activityRepository);
  const oilChange = activityRepository.seed(
    MaintenanceActivity.register(name('تعویض روغن')),
  );
  return { sut, activityRepository, oilChange };
}

describe('RenameMaintenanceActivityHandler', () => {
  it('renames an activity', async () => {
    const { sut, activityRepository, oilChange } = makeSut();

    await sut.execute(
      new RenameMaintenanceActivityCommand(
        oilChange.id,
        name('تعویض روغن موتور'),
      ),
    );

    const saved = await activityRepository.get(oilChange.id);
    expect(saved.name().asString()).toBe('تعویض روغن موتور');
  });

  it('accepts an activity keeping its own name', async () => {
    const { sut, activityRepository, oilChange } = makeSut();

    await sut.execute(
      new RenameMaintenanceActivityCommand(oilChange.id, name('تعویض روغن')),
    );

    const saved = await activityRepository.get(oilChange.id);
    expect(saved.name().asString()).toBe('تعویض روغن');
  });

  it('refuses a name another activity has', async () => {
    const { sut, activityRepository, oilChange } = makeSut();
    activityRepository.seed(MaintenanceActivity.register(name('گریس کاری')));

    await expect(
      sut.execute(
        new RenameMaintenanceActivityCommand(oilChange.id, name('گریس کاری')),
      ),
    ).rejects.toBeInstanceOf(MaintenanceActivityNameTaken);
  });

  it('refuses an unknown activity', async () => {
    const { sut } = makeSut();

    await expect(
      sut.execute(
        new RenameMaintenanceActivityCommand(Identity.new(), name('دیگر')),
      ),
    ).rejects.toBeInstanceOf(EntityNotFound);
  });
});
