import {
  ApplyToRelatedRecords,
  RecordDependencies,
  RecordHasDependents,
} from '@framework/application';
import { ImmediateUnitOfWork } from '@framework/application/support/immediate-unit-of-work';
import { StubCorrectionPropagator } from '@framework/application/support/stub-correction-propagator';
import { StubDependentsProbe } from '@framework/application/support/stub-dependents-probe';
import { EntityNotFound, Identity, Role } from '@framework/domain';
import { MaintenanceActivityNameTaken } from '@maintenance/application/exceptions';
import { ACTIVITY_SPECIALTY_LOCK } from '@maintenance/application/service/activity-specialty-lock';
import { PM_SNAPSHOT_NAMES_LOCK } from '@maintenance/application/service/pm-snapshot-names-lock';
import { InMemoryMaintenanceActivityRepository } from '@maintenance/application/support/in-memory-maintenance-activity-repository';
import { MaintenanceActivityEdited } from '@maintenance/domain/events/maintenance-activity-edited.event';
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
  const propagator = new StubCorrectionPropagator();
  const unitOfWork = new ImmediateUnitOfWork();
  const sut = new EditMaintenanceActivityHandler(
    activityRepository,
    new RecordDependencies([probe], [propagator]),
    unitOfWork,
  );
  const oilChange = activityRepository.seed(
    MaintenanceActivity.register(name('تعویض روغن'), mechanical),
  );
  return { sut, activityRepository, unitOfWork, oilChange, probe, propagator };
}

function heldByAPlan() {
  const world = makeSut();
  world.probe.given(
    { type: 'MaintenanceActivity', id: world.oilChange.id.asString() },
    [{ kind: 'equipment-pm-plan', name: 'پرس' }],
  );
  return world;
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

    // …and then, issue #110 (reviewer M3), the one execution recording holds,
    // so a corrected name never races a new execution's snapshot of it.
    expect(unitOfWork.lockKeysTaken()).toEqual([
      ACTIVITY_SPECIALTY_LOCK,
      PM_SNAPSHOT_NAMES_LOCK,
    ]);
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

  describe('the System Admin’s correction (issue #110)', () => {
    const admin = ApplyToRelatedRecords.askedBy(Role.SystemAdmin, true);

    it('renames an activity a PM plan holds, carrying the name into the plan and history', async () => {
      const { sut, activityRepository, oilChange, propagator } = heldByAPlan();

      await sut.execute(
        new EditMaintenanceActivityCommand(
          oilChange.id,
          name('تعویض روغن موتور'),
          mechanical,
          admin,
        ),
      );

      const reloaded = await activityRepository.get(oilChange.id);
      expect(reloaded.name().asString()).toBe('تعویض روغن موتور');
      expect(activityRepository.savedEvents).toEqual([
        new MaintenanceActivityEdited(
          oilChange.id.asString(),
          'تعویض روغن موتور',
          [
            {
              field: 'name',
              previousValue: 'تعویض روغن',
              newValue: 'تعویض روغن موتور',
            },
          ],
        ),
      ]);
      expect(propagator.propagated).toEqual([
        {
          reference: {
            type: 'MaintenanceActivity',
            id: oilChange.id.asString(),
          },
          correction: { name: 'تعویض روغن موتور' },
        },
      ]);
    });

    it('still refuses changing the specialty of an activity a PM plan holds', async () => {
      const { sut, activityRepository, oilChange, propagator } = heldByAPlan();

      await expect(
        sut.execute(
          new EditMaintenanceActivityCommand(
            oilChange.id,
            name('تعویض روغن موتور'),
            electrical,
            admin,
          ),
        ),
      ).rejects.toBeInstanceOf(RecordHasDependents);
      const reloaded = await activityRepository.get(oilChange.id);
      expect(reloaded.name().asString()).toBe('تعویض روغن');
      expect(propagator.propagated).toEqual([]);
    });

    it('is the ordinary refusal for anyone else who asks', async () => {
      const { sut, oilChange } = heldByAPlan();

      await expect(
        sut.execute(
          new EditMaintenanceActivityCommand(
            oilChange.id,
            name('تعویض روغن موتور'),
            mechanical,
            ApplyToRelatedRecords.askedBy(Role.TechnicalManager, true),
          ),
        ),
      ).rejects.toBeInstanceOf(RecordHasDependents);
    });

    it('still refuses a name another activity has', async () => {
      const { sut, activityRepository, oilChange, propagator } = heldByAPlan();
      activityRepository.seed(
        MaintenanceActivity.register(name('گریس کاری'), mechanical),
      );

      await expect(
        sut.execute(
          new EditMaintenanceActivityCommand(
            oilChange.id,
            name('گریس کاری'),
            mechanical,
            admin,
          ),
        ),
      ).rejects.toBeInstanceOf(MaintenanceActivityNameTaken);
      expect(propagator.propagated).toEqual([]);
    });
  });
});
