import { MaintenanceActivityNameTaken } from '@maintenance/application/exceptions';
import { InMemoryMaintenanceActivityRepository } from '@maintenance/application/support/in-memory-maintenance-activity-repository';
import { MaintenanceActivity } from '@maintenance/domain/maintenance-activity.aggregate';
import { ActivitySpecialty } from '@maintenance/domain/value/activity-specialty.vo';
import { MaintenanceActivityName } from '@maintenance/domain/value/maintenance-activity-name.vo';

import { RegisterMaintenanceActivityCommand } from './register-maintenance-activity.command';
import { RegisterMaintenanceActivityHandler } from './register-maintenance-activity.handler';

const name = (value: string) => MaintenanceActivityName.fromString(value);

function makeSut() {
  const activityRepository = new InMemoryMaintenanceActivityRepository();
  const sut = new RegisterMaintenanceActivityHandler(activityRepository);
  return { sut, activityRepository };
}

describe('RegisterMaintenanceActivityHandler', () => {
  it('registers an activity in the catalog, with its specialty', async () => {
    const { sut, activityRepository } = makeSut();

    const result = await sut.execute(
      new RegisterMaintenanceActivityCommand(
        name('تعویض روغن'),
        ActivitySpecialty.mechanical(),
      ),
    );

    const saved = await activityRepository.findByName(name('تعویض روغن'));
    expect(result).toEqual({ id: saved?.id.asString() });
    expect(saved?.specialty()).toEqual(ActivitySpecialty.mechanical());
  });

  it('refuses a name already in the catalog', async () => {
    const { sut, activityRepository } = makeSut();
    activityRepository.seed(
      MaintenanceActivity.register(
        name('تعویض روغن'),
        ActivitySpecialty.mechanical(),
      ),
    );

    await expect(
      sut.execute(
        new RegisterMaintenanceActivityCommand(
          name('تعویض روغن'),
          ActivitySpecialty.electrical(),
        ),
      ),
    ).rejects.toBeInstanceOf(MaintenanceActivityNameTaken);
  });
});
