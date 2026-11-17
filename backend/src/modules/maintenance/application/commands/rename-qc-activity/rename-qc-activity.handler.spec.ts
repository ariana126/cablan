import {
  ApplyToRelatedRecords,
  RecordDependencies,
  RecordHasDependents,
} from '@framework/application';
import { ImmediateUnitOfWork } from '@framework/application/support/immediate-unit-of-work';
import { StubCorrectionPropagator } from '@framework/application/support/stub-correction-propagator';
import { StubDependentsProbe } from '@framework/application/support/stub-dependents-probe';
import { Identity, Role } from '@framework/domain';
import {
  QcActivityNameTaken,
  QcActivityNotFound,
} from '@maintenance/application/exceptions';
import { InMemoryQcActivityRepository } from '@maintenance/application/support/in-memory-qc-activity-repository';
import { QcActivityRenamed } from '@maintenance/domain/events/qc-activity-renamed.event';
import { QcActivity } from '@maintenance/domain/qc-activity.aggregate';
import { QcActivityName } from '@maintenance/domain/value/qc-activity-name.vo';

import { RenameQcActivityCommand } from './rename-qc-activity.command';
import { RenameQcActivityHandler } from './rename-qc-activity.handler';

const name = (value: string) => QcActivityName.fromString(value);
const admin = ApplyToRelatedRecords.askedBy(Role.SystemAdmin, true);

async function nameOf(
  repository: InMemoryQcActivityRepository,
  activity: QcActivity,
): Promise<QcActivityName> {
  const reloaded = await repository.get(activity.id);
  return reloaded.name();
}

function makeSut() {
  const activityRepository = new InMemoryQcActivityRepository();
  const probe = new StubDependentsProbe();
  const propagator = new StubCorrectionPropagator();
  const sut = new RenameQcActivityHandler(
    activityRepository,
    new RecordDependencies([probe], [propagator]),
    new ImmediateUnitOfWork(),
  );
  const dimensional = activityRepository.seed(
    QcActivity.define(name('بازرسی ابعادی')),
  );
  const reference = {
    type: 'qc-activity' as const,
    id: dimensional.id.asString(),
  };
  return { sut, activityRepository, probe, propagator, dimensional, reference };
}

describe('RenameQcActivityHandler', () => {
  it('renames a QC activity nothing uses', async () => {
    const { sut, activityRepository, dimensional } = makeSut();

    await sut.execute(
      new RenameQcActivityCommand(dimensional.id, name('بازرسی ابعاد محصول')),
    );

    expect(await nameOf(activityRepository, dimensional)).toEqual(
      name('بازرسی ابعاد محصول'),
    );
    expect(activityRepository.savedEvents).toEqual([
      new QcActivityRenamed(
        dimensional.id.asString(),
        'بازرسی ابعادی',
        'بازرسی ابعاد محصول',
      ),
    ]);
  });

  it('refuses renaming an activity assigned or recorded, leaving it unchanged', async () => {
    const { sut, activityRepository, probe, dimensional, reference } =
      makeSut();
    probe.given(reference, [
      { kind: 'qc-assigned-equipment', name: 'اکسترودر 1' },
    ]);

    await expect(
      sut.execute(
        new RenameQcActivityCommand(dimensional.id, name('بازرسی ابعاد')),
      ),
    ).rejects.toBeInstanceOf(RecordHasDependents);
    expect(await nameOf(activityRepository, dimensional)).toEqual(
      name('بازرسی ابعادی'),
    );
    expect(activityRepository.savedEvents).toEqual([]);
  });

  it('refuses a name another QC activity has', async () => {
    const { sut, activityRepository, dimensional } = makeSut();
    activityRepository.seed(QcActivity.define(name('بازرسی ظاهری')));

    await expect(
      sut.execute(
        new RenameQcActivityCommand(dimensional.id, name('بازرسی ظاهری')),
      ),
    ).rejects.toBeInstanceOf(QcActivityNameTaken);
  });

  it('refuses an unknown QC activity', async () => {
    const { sut } = makeSut();

    await expect(
      sut.execute(new RenameQcActivityCommand(Identity.new(), name('دیگر'))),
    ).rejects.toBeInstanceOf(QcActivityNotFound);
  });

  describe('the System Admin’s correction', () => {
    it('renames an activity in use', async () => {
      const { sut, activityRepository, probe, dimensional, reference } =
        makeSut();
      probe.given(reference, [
        { kind: 'qc-activity-execution', name: 'execution-1' },
      ]);

      await sut.execute(
        new RenameQcActivityCommand(
          dimensional.id,
          name('بازرسی ابعاد'),
          admin,
        ),
      );

      expect(await nameOf(activityRepository, dimensional)).toEqual(
        name('بازرسی ابعاد'),
      );
    });

    it('is the ordinary refusal for Management asking for it', async () => {
      const { sut, probe, dimensional, reference } = makeSut();
      probe.given(reference, [
        { kind: 'qc-assigned-equipment', name: 'اکسترودر 1' },
      ]);

      await expect(
        sut.execute(
          new RenameQcActivityCommand(
            dimensional.id,
            name('بازرسی ابعاد'),
            ApplyToRelatedRecords.askedBy(Role.Management, true),
          ),
        ),
      ).rejects.toBeInstanceOf(RecordHasDependents);
    });

    it('still refuses a name another QC activity has', async () => {
      const { sut, activityRepository, dimensional } = makeSut();
      activityRepository.seed(QcActivity.define(name('بازرسی ظاهری')));

      await expect(
        sut.execute(
          new RenameQcActivityCommand(
            dimensional.id,
            name('بازرسی ظاهری'),
            admin,
          ),
        ),
      ).rejects.toBeInstanceOf(QcActivityNameTaken);
    });
  });
});
