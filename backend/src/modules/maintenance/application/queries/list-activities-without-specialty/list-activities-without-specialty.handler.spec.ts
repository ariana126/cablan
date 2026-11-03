import { Identity } from '@framework/domain';
import { InMemoryMaintenanceActivityRepository } from '@maintenance/application/support/in-memory-maintenance-activity-repository';
import { MaintenanceActivity } from '@maintenance/domain/maintenance-activity.aggregate';
import { ActivitySpecialty } from '@maintenance/domain/value/activity-specialty.vo';
import { MaintenanceActivityName } from '@maintenance/domain/value/maintenance-activity-name.vo';

import { ListActivitiesWithoutSpecialtyHandler } from './list-activities-without-specialty.handler';

const name = (value: string) => MaintenanceActivityName.fromString(value);

describe('ListActivitiesWithoutSpecialtyHandler', () => {
  it('lists the activities without a specialty, by Persian name', async () => {
    const activityRepository = new InMemoryMaintenanceActivityRepository();
    const withoutSpecialty = (activityName: string) =>
      activityRepository.seed(
        MaintenanceActivity.fromPersistence(
          Identity.new(),
          name(activityName),
          null,
        ),
      );
    const panelCheck = withoutSpecialty('تعویض فیلتر');
    const oilChange = withoutSpecialty('پاکسازی');
    activityRepository.seed(
      MaintenanceActivity.register(
        name('گریس کاری'),
        ActivitySpecialty.mechanical(),
      ),
    );

    const result = await new ListActivitiesWithoutSpecialtyHandler(
      activityRepository,
    ).execute();

    expect(result).toEqual([
      { id: oilChange.id.asString(), name: 'پاکسازی' },
      { id: panelCheck.id.asString(), name: 'تعویض فیلتر' },
    ]);
  });

  it('lists nothing once every activity has a specialty', async () => {
    const activityRepository = new InMemoryMaintenanceActivityRepository();
    activityRepository.seed(
      MaintenanceActivity.register(
        name('گریس کاری'),
        ActivitySpecialty.mechanical(),
      ),
    );

    expect(
      await new ListActivitiesWithoutSpecialtyHandler(
        activityRepository,
      ).execute(),
    ).toEqual([]);
  });
});
