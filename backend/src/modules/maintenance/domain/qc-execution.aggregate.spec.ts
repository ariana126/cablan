import { Identity } from '@framework/domain';

import { QcExecutionDeleted } from './events/qc-execution-deleted.event';
import { QcExecutionRecorded } from './events/qc-execution-recorded.event';
import { QcExecution, QcExecutionProps } from './qc-execution.aggregate';
import { QcTrackingNumber } from './value/qc-tracking-number.vo';

const equipmentId = Identity.new();
const activityId = Identity.new();
const performedById = Identity.new();
const performedAt = new Date('2026-09-23T04:30:00.000Z');
const subject = { equipmentName: 'اکسترودر 1', activityName: 'بازرسی ابعادی' };

function props(notes: string | null = null): QcExecutionProps {
  return {
    equipmentId,
    activityId,
    performedById,
    performedByName: 'نیکروش',
    performedAt,
    trackingNumber: QcTrackingNumber.fromString('TR-100'),
    notes,
  };
}

describe('QcExecution', () => {
  it('records who did which activity on which equipment, when, for which tracking number', () => {
    const sut = QcExecution.record(props('خراش جزئی روی روکش'), subject);

    expect(sut.releaseEvents()).toEqual([
      new QcExecutionRecorded(
        sut.id.asString(),
        equipmentId.asString(),
        'اکسترودر 1',
        activityId.asString(),
        'بازرسی ابعادی',
        performedAt,
        'نیکروش',
        'TR-100',
        'خراش جزئی روی روکش',
      ),
    ]);
  });

  it('keeps its notes trimmed', () => {
    const sut = QcExecution.record(props('  خراش جزئی  '), subject);

    expect(sut.notes()).toBe('خراش جزئی');
  });

  it.each(['', ' '.repeat(3)])('keeps blank notes (%p) as none', (notes) => {
    const sut = QcExecution.record(props(notes), subject);

    expect(sut.notes()).toBeNull();
  });

  it('records its deletion under the names its equipment and activity have now', () => {
    const sut = QcExecution.record(props(), subject);
    sut.releaseEvents();

    sut.delete({ equipmentName: 'اکسترودر یک', activityName: 'بازرسی ابعاد' });

    expect(sut.releaseEvents()).toEqual([
      new QcExecutionDeleted(
        sut.id.asString(),
        equipmentId.asString(),
        'اکسترودر یک',
        activityId.asString(),
        'بازرسی ابعاد',
        performedAt,
        'نیکروش',
        'TR-100',
      ),
    ]);
  });
});
