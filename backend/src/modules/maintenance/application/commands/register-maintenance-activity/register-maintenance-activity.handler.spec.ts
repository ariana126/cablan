import { MaintenanceActivityNameTaken } from '@maintenance/application/exceptions';
import { InMemoryMaintenanceActivityRepository } from '@maintenance/application/support/in-memory-maintenance-activity-repository';
import { MaintenanceActivity } from '@maintenance/domain/maintenance-activity.aggregate';
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
  it('registers an activity in the catalog', async () => {
    const { sut, activityRepository } = makeSut();

    const result = await sut.execute(
      new RegisterMaintenanceActivityCommand(name('تعویض روغن')),
    );

    const saved = await activityRepository.findByName(name('تعویض روغن'));
    expect(result).toEqual({ id: saved?.id.asString() });
  });

  it('refuses a name already in the catalog', async () => {
    const { sut, activityRepository } = makeSut();
    activityRepository.seed(MaintenanceActivity.register(name('تعویض روغن')));

    await expect(
      sut.execute(new RegisterMaintenanceActivityCommand(name('تعویض روغن'))),
    ).rejects.toBeInstanceOf(MaintenanceActivityNameTaken);
  });
});
