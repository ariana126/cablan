import {
  RecordDependencies,
  RecordHasDependents,
} from '@framework/application';
import { ImmediateUnitOfWork } from '@framework/application/support/immediate-unit-of-work';
import { StubDependentsProbe } from '@framework/application/support/stub-dependents-probe';
import { EntityNotFound, Identity } from '@framework/domain';
import { MaintenanceActivityNameTaken } from '@maintenance/application/exceptions';
import { ACTIVITY_SPECIALTY_LOCK } from '@maintenance/application/service/activity-specialty-lock';
import { InMemoryMaintenanceActivityRepository } from '@maintenance/application/support/in-memory-maintenance-activity-repository';
import { MaintenanceActivity } from '@maintenance/domain/maintenance-activity.aggregate';
import { ActivitySpecialty } from '@maintenance/domain/value/activity-specialty.vo';
import { MaintenanceActivityName } from '@maintenance/domain/value/maintenance-activity-name.vo';

import { EditMaintenanceActivityCommand } from './edit-maintenance-activity.command';
import { EditMaintenanceActivityHandler } from './edit-maintenance-activity.handler';

const name = (value: string) => MaintenanceActivityName.fromString(value);
const electrical = ActivitySpecialty.electrical();
const mechanical = ActivitySpecialty.mechanical();

function makeSut() {
  const activityRepository = new InMemoryMaintenanceActivityRepository();
  const probe = new StubDependentsProbe();
  const unitOfWork = new ImmediateUnitOfWork();
  const sut = new EditMaintenanceActivityHandler(
    activityRepository,
    new RecordDependencies([probe]),
    unitOfWork,
  );
  const oilChange = activityRepository.seed(
    MaintenanceActivity.register(name('تعویض روغن'), mechanical),
  );
  return { sut, activityRepository, unitOfWork, oilChange, probe };
}

describe('EditMaintenanceActivityHandler', () => {
  it('renames an activity and changes its specialty', async () => {
    const { sut, activityRepository, oilChange } = makeSut();

    await sut.execute(
      new EditMaintenanceActivityCommand(
        oilChange.id,
        name('بازرسی تابلو برق'),
        electrical,
      ),
    );

    const saved = await activityRepository.get(oilChange.id);
    expect(saved.name().asString()).toBe('بازرسی تابلو برق');
    expect(saved.specialty()).toEqual(electrical);
  });

  it('holds the activity-specialty lock the completion of missing specialties holds too', async () => {
    const { sut, unitOfWork, oilChange } = makeSut();

    await sut.execute(
      new EditMaintenanceActivityCommand(
        oilChange.id,
        name('تعویض روغن'),
        electrical,
      ),
    );

    expect(unitOfWork.lockKeysTaken()).toEqual([ACTIVITY_SPECIALTY_LOCK]);
  });

  it.each([
    ['its name', 'تعویض روغن موتور', mechanical],
    ['its specialty', 'تعویض روغن', electrical],
    ['nothing', 'تعویض روغن', mechanical],
  ])(
    'refuses changing %s while a PM plan holds the activity, leaving it unchanged',
    async (_change, newName, specialty) => {
      const { sut, activityRepository, oilChange, probe } = makeSut();
      probe.given(
        { type: 'MaintenanceActivity', id: oilChange.id.asString() },
        [{ kind: 'equipment-pm-plan', name: 'پرس' }],
      );

      await expect(
        sut.execute(
          new EditMaintenanceActivityCommand(
            oilChange.id,
            name(newName),
            specialty,
          ),
        ),
      ).rejects.toBeInstanceOf(RecordHasDependents);
      const kept = await activityRepository.get(oilChange.id);
      expect(kept.name().asString()).toBe('تعویض روغن');
      expect(kept.specialty()).toEqual(mechanical);
    },
  );

  it('accepts an activity keeping its own name', async () => {
    const { sut, activityRepository, oilChange } = makeSut();

    await sut.execute(
      new EditMaintenanceActivityCommand(
        oilChange.id,
        name('تعویض روغن'),
        electrical,
      ),
    );

    const saved = await activityRepository.get(oilChange.id);
    expect(saved.specialty()).toEqual(electrical);
  });

  it('refuses a name another activity has', async () => {
    const { sut, activityRepository, oilChange } = makeSut();
    activityRepository.seed(
      MaintenanceActivity.register(name('گریس کاری'), mechanical),
    );

    await expect(
      sut.execute(
        new EditMaintenanceActivityCommand(
          oilChange.id,
          name('گریس کاری'),
          mechanical,
        ),
      ),
    ).rejects.toBeInstanceOf(MaintenanceActivityNameTaken);
  });

  it('refuses an unknown activity', async () => {
    const { sut } = makeSut();

    await expect(
      sut.execute(
        new EditMaintenanceActivityCommand(
          Identity.new(),
          name('دیگر'),
          mechanical,
        ),
      ),
    ).rejects.toBeInstanceOf(EntityNotFound);
  });
});
