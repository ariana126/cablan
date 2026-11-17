import { QcActivityNameTaken } from '@maintenance/application/exceptions';
import { InMemoryQcActivityRepository } from '@maintenance/application/support/in-memory-qc-activity-repository';
import { QcActivityDefined } from '@maintenance/domain/events/qc-activity-defined.event';
import { QcActivity } from '@maintenance/domain/qc-activity.aggregate';
import { QcActivityName } from '@maintenance/domain/value/qc-activity-name.vo';

import { DefineQcActivityCommand } from './define-qc-activity.command';
import { DefineQcActivityHandler } from './define-qc-activity.handler';

const name = (value: string) => QcActivityName.fromString(value);

function makeSut() {
  const activityRepository = new InMemoryQcActivityRepository();
  const sut = new DefineQcActivityHandler(activityRepository);
  return { sut, activityRepository };
}

describe('DefineQcActivityHandler', () => {
  it('defines a QC activity, answering its id', async () => {
    const { sut, activityRepository } = makeSut();

    const result = await sut.execute(
      new DefineQcActivityCommand(name('بازرسی ابعادی')),
    );

    const saved = await activityRepository.findByName(name('بازرسی ابعادی'));
    expect(result).toEqual({ id: saved?.id.asString() });
    expect(activityRepository.savedEvents).toEqual([
      new QcActivityDefined(result.id, 'بازرسی ابعادی'),
    ]);
  });

  it('refuses a name already in the QC catalog', async () => {
    const { sut, activityRepository } = makeSut();
    activityRepository.seed(QcActivity.define(name('بازرسی ابعادی')));

    await expect(
      sut.execute(new DefineQcActivityCommand(name('بازرسی ابعادی'))),
    ).rejects.toBeInstanceOf(QcActivityNameTaken);
    expect(await activityRepository.list()).toHaveLength(1);
  });
});
