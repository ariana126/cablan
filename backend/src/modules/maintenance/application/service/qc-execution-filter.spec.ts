import { Identity } from '@framework/domain';
import { InvalidQcExecutionRange } from '@maintenance/application/exceptions';

import { QcExecutionFilter } from './qc-execution-filter';

const MORNING = new Date('2026-09-23T04:30:00.000Z');
const EVENING = new Date('2026-09-23T16:30:00.000Z');

const none = {
  from: null,
  to: null,
  equipmentId: null,
  activityId: null,
  performedById: null,
  trackingNumber: null,
};

describe('QcExecutionFilter', () => {
  it('keeps the criteria it was given', () => {
    const equipmentId = Identity.new();

    const sut = QcExecutionFilter.of({
      ...none,
      from: MORNING,
      to: EVENING,
      equipmentId,
    });

    expect(sut.from).toEqual(MORNING);
    expect(sut.to).toEqual(EVENING);
    expect(sut.equipmentId).toEqual(equipmentId);
  });

  it('takes a range of one instant', () => {
    expect(
      QcExecutionFilter.of({ ...none, from: MORNING, to: MORNING }).from,
    ).toEqual(MORNING);
  });

  it('refuses a range starting after it ends', () => {
    expect(() =>
      QcExecutionFilter.of({ ...none, from: EVENING, to: MORNING }),
    ).toThrow(InvalidQcExecutionRange);
  });

  it('searches a tracking number trimmed, with Persian-keyboard digits as English ones', () => {
    expect(
      QcExecutionFilter.of({ ...none, trackingNumber: '  tr-۱۰۱ ' })
        .trackingNumber,
    ).toBe('tr-101');
  });

  it.each(['', ' '.repeat(3)])(
    'reads a blank tracking number (%p) as no search',
    (trackingNumber) => {
      expect(
        QcExecutionFilter.of({ ...none, trackingNumber }).trackingNumber,
      ).toBeNull();
    },
  );
});
