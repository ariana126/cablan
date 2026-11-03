import { Identity } from '@framework/domain';

import { MaintenanceActivityEdited } from './events/maintenance-activity-edited.event';
import { MaintenanceActivityRegistered } from './events/maintenance-activity-registered.event';
import { MaintenanceActivitySpecialtyAssigned } from './events/maintenance-activity-specialty-assigned.event';
import { ActivityAlreadyHasSpecialty } from './exceptions/activity-already-has-specialty.exception';
import { MaintenanceActivity } from './maintenance-activity.aggregate';
import { ActivitySpecialty } from './value/activity-specialty.vo';
import { MaintenanceActivityName } from './value/maintenance-activity-name.vo';

const name = (value: string) => MaintenanceActivityName.fromString(value);
const electrical = ActivitySpecialty.electrical();
const mechanical = ActivitySpecialty.mechanical();

function registered(activityName = 'تعویض روغن', specialty = mechanical) {
  const activity = MaintenanceActivity.register(name(activityName), specialty);
  activity.releaseEvents();
  return activity;
}

/** An activity registered before specialties existed. */
function withoutSpecialty(activityName = 'تعویض روغن') {
  return MaintenanceActivity.fromPersistence(
    Identity.new(),
    name(activityName),
    null,
  );
}

describe('MaintenanceActivity', () => {
  it('is registered by name and specialty', () => {
    const activity = MaintenanceActivity.register(
      name('تعویض روغن'),
      mechanical,
    );

    expect(activity.name().asString()).toBe('تعویض روغن');
    expect(activity.specialty()).toEqual(mechanical);
    expect(activity.releaseEvents()).toEqual([
      new MaintenanceActivityRegistered(
        activity.id.asString(),
        'تعویض روغن',
        'mechanical',
      ),
    ]);
  });

  describe('edit', () => {
    it('renames it, as one edit with a name line', () => {
      const activity = registered();

      activity.edit(name('تعویض فیلتر'), mechanical);

      expect(activity.name().asString()).toBe('تعویض فیلتر');
      expect(activity.releaseEvents()).toEqual([
        new MaintenanceActivityEdited(activity.id.asString(), 'تعویض فیلتر', [
          {
            field: 'name',
            previousValue: 'تعویض روغن',
            newValue: 'تعویض فیلتر',
          },
        ]),
      ]);
    });

    it('changes its specialty, as one edit with a specialty line', () => {
      const activity = registered();

      activity.edit(name('تعویض روغن'), electrical);

      expect(activity.specialty()).toEqual(electrical);
      expect(activity.releaseEvents()).toEqual([
        new MaintenanceActivityEdited(activity.id.asString(), 'تعویض روغن', [
          {
            field: 'specialty',
            previousValue: 'mechanical',
            newValue: 'electrical',
          },
        ]),
      ]);
    });

    it('renames it and changes its specialty as one edit, named by its new name', () => {
      const activity = registered();

      activity.edit(name('بازرسی تابلو'), electrical);

      expect(activity.releaseEvents()).toEqual([
        new MaintenanceActivityEdited(activity.id.asString(), 'بازرسی تابلو', [
          {
            field: 'name',
            previousValue: 'تعویض روغن',
            newValue: 'بازرسی تابلو',
          },
          {
            field: 'specialty',
            previousValue: 'mechanical',
            newValue: 'electrical',
          },
        ]),
      ]);
    });

    it('records nothing when nothing changes', () => {
      const activity = registered();

      activity.edit(name('تعویض روغن'), mechanical);

      expect(activity.releaseEvents()).toEqual([]);
    });

    it('gives an activity without a specialty its first one, from nothing', () => {
      const activity = withoutSpecialty();

      activity.edit(name('تعویض روغن'), electrical);

      expect(activity.specialty()).toEqual(electrical);
      expect(activity.releaseEvents()).toEqual([
        new MaintenanceActivityEdited(activity.id.asString(), 'تعویض روغن', [
          { field: 'specialty', previousValue: '', newValue: 'electrical' },
        ]),
      ]);
    });
  });

  describe('completeMissingSpecialty', () => {
    it('gives an activity without a specialty the one it lacks', () => {
      const activity = withoutSpecialty();

      activity.completeMissingSpecialty(electrical);

      expect(activity.specialty()).toEqual(electrical);
      expect(activity.releaseEvents()).toEqual([
        new MaintenanceActivitySpecialtyAssigned(
          activity.id.asString(),
          'تعویض روغن',
          'electrical',
        ),
      ]);
    });

    it('refuses an activity that already has a specialty, leaving it unchanged', () => {
      const activity = registered();

      expect(() => activity.completeMissingSpecialty(electrical)).toThrow(
        ActivityAlreadyHasSpecialty,
      );
      expect(activity.specialty()).toEqual(mechanical);
      expect(activity.releaseEvents()).toEqual([]);
    });

    it('refuses completing it a second time', () => {
      const activity = withoutSpecialty();
      activity.completeMissingSpecialty(electrical);

      expect(() => activity.completeMissingSpecialty(mechanical)).toThrow(
        ActivityAlreadyHasSpecialty,
      );
    });
  });

  it('tells whether it has a specialty yet', () => {
    expect(registered().hasSpecialty()).toBe(true);
    expect(withoutSpecialty().hasSpecialty()).toBe(false);
  });
});
