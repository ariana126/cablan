import { QcActivityDefined } from './events/qc-activity-defined.event';
import { QcActivityDeleted } from './events/qc-activity-deleted.event';
import { QcActivityRenamed } from './events/qc-activity-renamed.event';
import { QcActivity } from './qc-activity.aggregate';
import { QcActivityName } from './value/qc-activity-name.vo';

const name = (value: string) => QcActivityName.fromString(value);

function defined(value: string): QcActivity {
  const activity = QcActivity.define(name(value));
  activity.releaseEvents();
  return activity;
}

describe('QcActivity', () => {
  it('is defined on its own, with no equipment', () => {
    const sut = QcActivity.define(name('بازرسی ابعادی'));

    expect(sut.releaseEvents()).toEqual([
      new QcActivityDefined(sut.id.asString(), 'بازرسی ابعادی'),
    ]);
  });

  it('is renamed, recording the previous and the new name', () => {
    const sut = defined('بازرسی ابعادی');

    sut.rename(name('بازرسی ابعاد محصول'));

    expect(sut.name().asString()).toBe('بازرسی ابعاد محصول');
    expect(sut.releaseEvents()).toEqual([
      new QcActivityRenamed(
        sut.id.asString(),
        'بازرسی ابعادی',
        'بازرسی ابعاد محصول',
      ),
    ]);
  });

  it('records nothing when renamed to the name it has', () => {
    const sut = defined('بازرسی ابعادی');

    sut.rename(name('  بازرسی ابعادی '));

    expect(sut.releaseEvents()).toEqual([]);
  });

  it('records its deletion with its name', () => {
    const sut = defined('بازرسی ابعادی');

    sut.delete();

    expect(sut.releaseEvents()).toEqual([
      new QcActivityDeleted(sut.id.asString(), 'بازرسی ابعادی'),
    ]);
  });

  it('changes only correctable fields when edited, its name being its only field', () => {
    expect(defined('بازرسی ابعادی').changesOnlyCorrectableFields()).toBe(true);
  });
});
