import {
  RecordDependencies,
  RecordHasDependents,
} from '@framework/application';
import { StubDependentsProbe } from '@framework/application/support/stub-dependents-probe';
import { Identity } from '@framework/domain';
import {
  QcActivityNotFound,
  QcActivityStillReferenced,
} from '@maintenance/application/exceptions';
import { InMemoryQcActivityRepository } from '@maintenance/application/support/in-memory-qc-activity-repository';
import { QcActivityDeleted } from '@maintenance/domain/events/qc-activity-deleted.event';
import { QcActivity } from '@maintenance/domain/qc-activity.aggregate';
import { QcActivityName } from '@maintenance/domain/value/qc-activity-name.vo';

import { DeleteQcActivityCommand } from './delete-qc-activity.command';
import { DeleteQcActivityHandler } from './delete-qc-activity.handler';

function makeSut() {
  const activityRepository = new InMemoryQcActivityRepository();
  const probe = new StubDependentsProbe();
  const sut = new DeleteQcActivityHandler(
    activityRepository,
    new RecordDependencies([probe]),
  );
  const dimensional = activityRepository.seed(
    QcActivity.define(QcActivityName.fromString('بازرسی ابعادی')),
  );
  return { sut, activityRepository, probe, dimensional };
}

describe('DeleteQcActivityHandler', () => {
  it('deletes a QC activity nothing uses', async () => {
    const { sut, activityRepository, dimensional } = makeSut();

    await sut.execute(new DeleteQcActivityCommand(dimensional.id));

    expect(await activityRepository.find(dimensional.id)).toBeNull();
    expect(activityRepository.savedEvents).toEqual([
      new QcActivityDeleted(dimensional.id.asString(), 'بازرسی ابعادی'),
    ]);
  });

  it('refuses an activity with a QC record, even once unassigned, keeping it', async () => {
    const { sut, activityRepository, probe, dimensional } = makeSut();
    probe.given({ type: 'qc-activity', id: dimensional.id.asString() }, [
      { kind: 'qc-activity-execution', name: 'execution-1' },
    ]);

    await expect(
      sut.execute(new DeleteQcActivityCommand(dimensional.id)),
    ).rejects.toBeInstanceOf(RecordHasDependents);
    expect(await activityRepository.find(dimensional.id)).toBe(dimensional);
    expect(activityRepository.savedEvents).toEqual([]);
  });

  // A reference made after the guard's check (it is check-then-act) makes
  // the database's foreign key refuse the delete; the answer is still the
  // ordinary refusal, naming what references it now.
  it('refuses an activity referenced after the check, as the ordinary refusal', async () => {
    const { activityRepository, probe, dimensional } = makeSut();
    const reference = {
      type: 'qc-activity' as const,
      id: dimensional.id.asString(),
    };
    const racedRepository = Object.assign(
      Object.create(activityRepository) as InMemoryQcActivityRepository,
      {
        delete: () => {
          probe.given(reference, [
            { kind: 'qc-assigned-equipment', name: 'اکسترودر 1' },
          ]);
          return Promise.reject(
            QcActivityStillReferenced.withId(dimensional.id),
          );
        },
      },
    );
    const sut = new DeleteQcActivityHandler(
      racedRepository,
      new RecordDependencies([probe]),
    );

    await expect(
      sut.execute(new DeleteQcActivityCommand(dimensional.id)),
    ).rejects.toBeInstanceOf(RecordHasDependents);
  });

  it('refuses an unknown QC activity', async () => {
    const { sut } = makeSut();

    await expect(
      sut.execute(new DeleteQcActivityCommand(Identity.new())),
    ).rejects.toBeInstanceOf(QcActivityNotFound);
  });
});
