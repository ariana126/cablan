import { Identity } from '@framework/domain';

import { Equipment } from './equipment.aggregate';
import { QcActivityAssigned } from './events/qc-activity-assigned.event';
import { QcActivityUnassigned } from './events/qc-activity-unassigned.event';
import { QcExecutionRecorded } from './events/qc-execution-recorded.event';
import { EquipmentIsRetired } from './exceptions/equipment-is-retired.exception';
import { QcActivityAlreadyAssigned } from './exceptions/qc-activity-already-assigned.exception';
import { QcActivityNotAssigned } from './exceptions/qc-activity-not-assigned.exception';
import { QcActivity } from './qc-activity.aggregate';
import { EquipmentName } from './value/equipment-name.vo';
import { QcActivityName } from './value/qc-activity-name.vo';
import { QcTrackingNumber } from './value/qc-tracking-number.vo';

// Issue #119: an equipment's QC assignments are its own, so "assigned to
// in-service equipment" is one aggregate's answer.
const NOW = new Date('2026-09-23T04:30:00.000Z');
const LATER = new Date('2026-09-24T04:30:00.000Z');
const INSPECTOR = { id: Identity.new(), name: 'نیکروش' };
const REPORT = {
  trackingNumber: QcTrackingNumber.fromString('TR-100'),
  notes: null,
};

function qcActivity(name: string): QcActivity {
  const activity = QcActivity.define(QcActivityName.fromString(name));
  activity.releaseEvents();
  return activity;
}

function extruder(): Equipment {
  const equipment = Equipment.register(EquipmentName.fromString('اکسترودر 1'));
  equipment.releaseEvents();
  return equipment;
}

function extruderAssigned(activity: QcActivity): Equipment {
  const equipment = extruder();
  equipment.assignQcActivity(activity);
  equipment.releaseEvents();
  return equipment;
}

function refusalOf(action: () => unknown): unknown {
  try {
    action();
    return null;
  } catch (error) {
    return error;
  }
}

describe('Equipment’s QC activities', () => {
  const dimensional = qcActivity('بازرسی ابعادی');
  const visual = qcActivity('بازرسی ظاهری');

  describe('assigning', () => {
    it('assigns a QC activity, recording it under both names', () => {
      const sut = extruder();

      sut.assignQcActivity(dimensional);

      expect(sut.qcActivityIds()).toEqual([dimensional.id]);
      expect(sut.releaseEvents()).toEqual([
        new QcActivityAssigned(
          sut.id.asString(),
          'اکسترودر 1',
          dimensional.id.asString(),
          'بازرسی ابعادی',
        ),
      ]);
    });

    it('takes several QC activities', () => {
      const sut = extruder();

      sut.assignQcActivity(dimensional);
      sut.assignQcActivity(visual);

      expect(sut.qcActivityIds()).toEqual([dimensional.id, visual.id]);
    });

    it('refuses an activity already assigned to it, changing nothing', () => {
      const sut = extruderAssigned(dimensional);

      expect(() => sut.assignQcActivity(dimensional)).toThrow(
        QcActivityAlreadyAssigned,
      );
      expect(sut.qcActivityIds()).toEqual([dimensional.id]);
      expect(sut.releaseEvents()).toEqual([]);
    });

    it('refuses any assignment while retired, naming the equipment', () => {
      const sut = extruder();
      sut.retire(NOW);
      sut.releaseEvents();

      const refusal = refusalOf(() => sut.assignQcActivity(dimensional));

      expect(refusal).toBeInstanceOf(EquipmentIsRetired);
      expect((refusal as EquipmentIsRetired).equipmentName).toBe('اکسترودر 1');
      expect(sut.qcActivityIds()).toEqual([]);
    });
  });

  describe('unassigning', () => {
    it('unassigns a QC activity, recording it under both names', () => {
      const sut = extruderAssigned(dimensional);

      sut.unassignQcActivity(dimensional);

      expect(sut.qcActivityIds()).toEqual([]);
      expect(sut.releaseEvents()).toEqual([
        new QcActivityUnassigned(
          sut.id.asString(),
          'اکسترودر 1',
          dimensional.id.asString(),
          'بازرسی ابعادی',
        ),
      ]);
    });

    it('refuses an activity not assigned to it', () => {
      const sut = extruderAssigned(visual);

      const refusal = refusalOf(() => sut.unassignQcActivity(dimensional));

      expect(refusal).toBeInstanceOf(QcActivityNotAssigned);
      expect((refusal as QcActivityNotAssigned).attempt).toBe('unassign');
      expect(sut.qcActivityIds()).toEqual([visual.id]);
    });

    it('refuses unassigning while retired, keeping the assignment', () => {
      const sut = extruderAssigned(dimensional);
      sut.retire(NOW);

      expect(() => sut.unassignQcActivity(dimensional)).toThrow(
        EquipmentIsRetired,
      );
      expect(sut.qcActivityIds()).toEqual([dimensional.id]);
    });

    it('takes the activity again once unassigned', () => {
      const sut = extruderAssigned(dimensional);
      sut.unassignQcActivity(dimensional);

      sut.assignQcActivity(dimensional);

      expect(sut.qcActivityIds()).toEqual([dimensional.id]);
    });
  });

  describe('recording that an activity was done', () => {
    it('records an assigned activity done now by the performer, for the tracking number', () => {
      const sut = extruderAssigned(dimensional);

      const execution = sut.recordQcExecutionOf(
        dimensional,
        NOW,
        INSPECTOR,
        REPORT,
      );

      expect(execution.releaseEvents()).toEqual([
        new QcExecutionRecorded(
          execution.id.asString(),
          sut.id.asString(),
          'اکسترودر 1',
          dimensional.id.asString(),
          'بازرسی ابعادی',
          NOW,
          'نیکروش',
          'TR-100',
          null,
        ),
      ]);
      expect(sut.releaseEvents()).toEqual([]);
    });

    it('refuses an activity not assigned to it, naming both', () => {
      const sut = extruderAssigned(visual);

      const refusal = refusalOf(() =>
        sut.recordQcExecutionOf(dimensional, NOW, INSPECTOR, REPORT),
      );

      expect(refusal).toBeInstanceOf(QcActivityNotAssigned);
      const notAssigned = refusal as QcActivityNotAssigned;
      expect(notAssigned.attempt).toBe('record');
      expect(notAssigned.activityName).toBe('بازرسی ابعادی');
      expect(notAssigned.equipmentName).toBe('اکسترودر 1');
    });

    it('refuses an activity unassigned since', () => {
      const sut = extruderAssigned(dimensional);
      sut.unassignQcActivity(dimensional);

      expect(() =>
        sut.recordQcExecutionOf(dimensional, NOW, INSPECTOR, REPORT),
      ).toThrow(QcActivityNotAssigned);
    });

    it('refuses retired equipment before asking whether the activity is assigned', () => {
      const sut = extruder();
      sut.retire(NOW);

      expect(() =>
        sut.recordQcExecutionOf(dimensional, LATER, INSPECTOR, REPORT),
      ).toThrow(EquipmentIsRetired);
    });

    it('records again for equipment reactivated, its assignments kept', () => {
      const sut = extruderAssigned(dimensional);
      sut.retire(NOW);
      sut.reactivate(LATER, []);

      const execution = sut.recordQcExecutionOf(
        dimensional,
        LATER,
        INSPECTOR,
        REPORT,
      );

      expect(execution.activityId()).toEqual(dimensional.id);
    });
  });

  it('is rebuilt with its stored QC assignments', () => {
    const sut = Equipment.fromPersistence(
      Identity.new(),
      EquipmentName.fromString('اکسترودر 1'),
      [],
      [],
      [dimensional.id, visual.id],
    );

    expect(sut.qcActivityIds()).toEqual([dimensional.id, visual.id]);
  });
});
