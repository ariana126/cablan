import {
  AuditAction,
  AuditRecordType,
} from '@audit-logging/application/service/audit-log.repository';
import { AuditLogProjector } from '@audit-logging/application/service/audit-log-projector.service';
import { QcActivityAssigned } from '@maintenance/domain/events/qc-activity-assigned.event';
import { QcActivityDefined } from '@maintenance/domain/events/qc-activity-defined.event';
import { QcActivityDeleted } from '@maintenance/domain/events/qc-activity-deleted.event';
import { QcActivityRenamed } from '@maintenance/domain/events/qc-activity-renamed.event';
import { QcActivityUnassigned } from '@maintenance/domain/events/qc-activity-unassigned.event';
import { QcExecutionDeleted } from '@maintenance/domain/events/qc-execution-deleted.event';
import { QcExecutionRecorded } from '@maintenance/domain/events/qc-execution-recorded.event';

import { QcActivityAssignedAuditHandler } from './qc-activity-assigned.handler';
import { QcActivityDefinedAuditHandler } from './qc-activity-defined.handler';
import { QcActivityDeletedAuditHandler } from './qc-activity-deleted.handler';
import { QcActivityRenamedAuditHandler } from './qc-activity-renamed.handler';
import { QcActivityUnassignedAuditHandler } from './qc-activity-unassigned.handler';
import { QcExecutionDeletedAuditHandler } from './qc-execution-deleted.handler';
import { QcExecutionRecordedAuditHandler } from './qc-execution-recorded.handler';

function fakeProjector() {
  const projector = { project: jest.fn().mockResolvedValue() };
  return {
    projector,
    asPort: projector as unknown as AuditLogProjector,
  };
}

const PERFORMED_AT = new Date('2026-09-23T04:30:00.000Z');

// Production QC (issue #119).
describe('QC audit handlers', () => {
  it('projects QcActivityDefined as a QcActivity Registered entry with its name', async () => {
    const { projector, asPort } = fakeProjector();

    await new QcActivityDefinedAuditHandler(asPort).handle(
      new QcActivityDefined('qc-1', 'بازرسی ابعادی'),
    );

    expect(projector.project).toHaveBeenCalledWith(
      AuditRecordType.QcActivity,
      'qc-1',
      AuditAction.Registered,
      [{ field: 'name', previousValue: '', newValue: 'بازرسی ابعادی' }],
    );
  });

  it('projects QcActivityRenamed as a QcActivity Edited entry with the name before and after', async () => {
    const { projector, asPort } = fakeProjector();

    await new QcActivityRenamedAuditHandler(asPort).handle(
      new QcActivityRenamed('qc-1', 'بازرسی ابعادی', 'بازرسی ابعاد'),
    );

    expect(projector.project).toHaveBeenCalledWith(
      AuditRecordType.QcActivity,
      'qc-1',
      AuditAction.Edited,
      [
        {
          field: 'name',
          previousValue: 'بازرسی ابعادی',
          newValue: 'بازرسی ابعاد',
        },
      ],
    );
  });

  it('projects QcActivityDeleted as a QcActivity Deleted entry with its name', async () => {
    const { projector, asPort } = fakeProjector();

    await new QcActivityDeletedAuditHandler(asPort).handle(
      new QcActivityDeleted('qc-1', 'بازرسی ابعادی'),
    );

    expect(projector.project).toHaveBeenCalledWith(
      AuditRecordType.QcActivity,
      'qc-1',
      AuditAction.Deleted,
      [{ field: 'name', previousValue: 'بازرسی ابعادی', newValue: '' }],
    );
  });

  it('projects QcActivityAssigned as an Equipment Edited entry adding the QC activity, named by the equipment', async () => {
    const { projector, asPort } = fakeProjector();

    await new QcActivityAssignedAuditHandler(asPort).handle(
      new QcActivityAssigned(
        'equipment-1',
        'اکسترودر 1',
        'qc-1',
        'بازرسی ابعادی',
      ),
    );

    expect(projector.project).toHaveBeenCalledWith(
      AuditRecordType.Equipment,
      'equipment-1',
      AuditAction.Edited,
      [{ field: 'qcActivity', previousValue: '', newValue: 'بازرسی ابعادی' }],
      { field: 'name', value: 'اکسترودر 1' },
    );
  });

  it('projects QcActivityUnassigned as an Equipment Edited entry removing the QC activity, named by the equipment', async () => {
    const { projector, asPort } = fakeProjector();

    await new QcActivityUnassignedAuditHandler(asPort).handle(
      new QcActivityUnassigned(
        'equipment-1',
        'اکسترودر 1',
        'qc-1',
        'بازرسی ابعادی',
      ),
    );

    expect(projector.project).toHaveBeenCalledWith(
      AuditRecordType.Equipment,
      'equipment-1',
      AuditAction.Edited,
      [{ field: 'qcActivity', previousValue: 'بازرسی ابعادی', newValue: '' }],
      { field: 'name', value: 'اکسترودر 1' },
    );
  });

  it('projects QcExecutionRecorded as a QcExecution Registered entry with what was done, when, by whom and for which tracking number', async () => {
    const { projector, asPort } = fakeProjector();

    await new QcExecutionRecordedAuditHandler(asPort).handle(
      new QcExecutionRecorded(
        'record-1',
        'equipment-1',
        'اکسترودر 1',
        'qc-1',
        'بازرسی ابعادی',
        PERFORMED_AT,
        'نیکروش',
        'TR-100',
        'خراش جزئی',
      ),
    );

    expect(projector.project).toHaveBeenCalledWith(
      AuditRecordType.QcExecution,
      'record-1',
      AuditAction.Registered,
      [
        { field: 'equipment', previousValue: '', newValue: 'اکسترودر 1' },
        { field: 'activity', previousValue: '', newValue: 'بازرسی ابعادی' },
        {
          field: 'performedAt',
          previousValue: '',
          newValue: '2026-09-23T04:30:00.000Z',
        },
        { field: 'performedBy', previousValue: '', newValue: 'نیکروش' },
        { field: 'trackingNumber', previousValue: '', newValue: 'TR-100' },
        { field: 'notes', previousValue: '', newValue: 'خراش جزئی' },
      ],
    );
  });

  it('leaves out the notes of a QC record made without any', async () => {
    const { projector, asPort } = fakeProjector();

    await new QcExecutionRecordedAuditHandler(asPort).handle(
      new QcExecutionRecorded(
        'record-1',
        'equipment-1',
        'اکسترودر 1',
        'qc-1',
        'بازرسی ابعادی',
        PERFORMED_AT,
        'نیکروش',
        'TR-100',
        null,
      ),
    );

    const lines = (
      projector.project.mock.calls[0] as [
        unknown,
        unknown,
        unknown,
        { field: string }[],
      ]
    )[3];
    expect(lines.map((line) => line.field)).not.toContain('notes');
  });

  it('projects QcExecutionDeleted as a QcExecution Deleted entry', async () => {
    const { projector, asPort } = fakeProjector();

    await new QcExecutionDeletedAuditHandler(asPort).handle(
      new QcExecutionDeleted(
        'record-1',
        'equipment-1',
        'اکسترودر 1',
        'qc-1',
        'بازرسی ابعادی',
        PERFORMED_AT,
        'نیکروش',
        'TR-100',
      ),
    );

    expect(projector.project).toHaveBeenCalledWith(
      AuditRecordType.QcExecution,
      'record-1',
      AuditAction.Deleted,
      [
        { field: 'equipment', previousValue: 'اکسترودر 1', newValue: '' },
        { field: 'activity', previousValue: 'بازرسی ابعادی', newValue: '' },
        {
          field: 'performedAt',
          previousValue: '2026-09-23T04:30:00.000Z',
          newValue: '',
        },
        { field: 'performedBy', previousValue: 'نیکروش', newValue: '' },
        { field: 'trackingNumber', previousValue: 'TR-100', newValue: '' },
      ],
    );
  });
});
