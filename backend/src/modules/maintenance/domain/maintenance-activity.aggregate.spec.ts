import { MaintenanceActivityRegistered } from './events/maintenance-activity-registered.event';
import { MaintenanceActivityRenamed } from './events/maintenance-activity-renamed.event';
import { MaintenanceActivity } from './maintenance-activity.aggregate';
import { MaintenanceActivityName } from './value/maintenance-activity-name.vo';

const name = (value: string) => MaintenanceActivityName.fromString(value);

describe('MaintenanceActivity', () => {
  it('is registered by name', () => {
    const activity = MaintenanceActivity.register(name('تعویض روغن'));

    expect(activity.name().asString()).toBe('تعویض روغن');
    expect(activity.releaseEvents()).toEqual([
      new MaintenanceActivityRegistered(activity.id.asString(), 'تعویض روغن'),
    ]);
  });

  it('is renamed', () => {
    const activity = MaintenanceActivity.register(name('تعویض روغن'));
    activity.releaseEvents();

    activity.rename(name('تعویض فیلتر'));

    expect(activity.name().asString()).toBe('تعویض فیلتر');
    expect(activity.releaseEvents()).toEqual([
      new MaintenanceActivityRenamed(
        activity.id.asString(),
        'تعویض روغن',
        'تعویض فیلتر',
      ),
    ]);
  });

  it('records nothing when renamed to the name it already has', () => {
    const activity = MaintenanceActivity.register(name('تعویض روغن'));
    activity.releaseEvents();

    activity.rename(name('تعویض روغن'));

    expect(activity.releaseEvents()).toEqual([]);
  });
});
