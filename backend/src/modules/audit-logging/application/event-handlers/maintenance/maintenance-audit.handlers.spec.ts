import {
  AuditAction,
  AuditRecordType,
} from '@audit-logging/application/service/audit-log.repository';
import { AuditLogProjector } from '@audit-logging/application/service/audit-log-projector.service';
import { EquipmentRegistered } from '@maintenance/domain/events/equipment-registered.event';
import { EquipmentRenamed } from '@maintenance/domain/events/equipment-renamed.event';
import { EquipmentRetired } from '@maintenance/domain/events/equipment-retired.event';
import { MaintenanceActivityRegistered } from '@maintenance/domain/events/maintenance-activity-registered.event';
import { MaintenanceActivityRenamed } from '@maintenance/domain/events/maintenance-activity-renamed.event';
import { MaintenanceExecutionRecorded } from '@maintenance/domain/events/maintenance-execution-recorded.event';
import { PmPlanItemAdded } from '@maintenance/domain/events/pm-plan-item-added.event';
import { PmPlanItemIntervalChanged } from '@maintenance/domain/events/pm-plan-item-interval-changed.event';
import { PmPlanItemRemoved } from '@maintenance/domain/events/pm-plan-item-removed.event';

import { EquipmentRegisteredAuditHandler } from './equipment-registered.handler';
import { EquipmentRenamedAuditHandler } from './equipment-renamed.handler';
import { EquipmentRetiredAuditHandler } from './equipment-retired.handler';
import { MaintenanceActivityRegisteredAuditHandler } from './maintenance-activity-registered.handler';
import { MaintenanceActivityRenamedAuditHandler } from './maintenance-activity-renamed.handler';
import { MaintenanceExecutionRecordedAuditHandler } from './maintenance-execution-recorded.handler';
import { PmPlanItemAddedAuditHandler } from './pm-plan-item-added.handler';
import { PmPlanItemIntervalChangedAuditHandler } from './pm-plan-item-interval-changed.handler';
import { PmPlanItemRemovedAuditHandler } from './pm-plan-item-removed.handler';

function fakeProjector() {
  const projector = { project: jest.fn().mockResolvedValue() };
  return {
    projector,
    asPort: projector as unknown as AuditLogProjector,
  };
}

describe('maintenance audit handlers', () => {
  it('projects EquipmentRegistered as an Equipment Registered entry with its name', async () => {
    const { projector, asPort } = fakeProjector();

    await new EquipmentRegisteredAuditHandler(asPort).handle(
      new EquipmentRegistered('equipment-1', 'اکسترودر'),
    );

    expect(projector.project).toHaveBeenCalledWith(
      AuditRecordType.Equipment,
      'equipment-1',
      AuditAction.Registered,
      [{ field: 'name', previousValue: '', newValue: 'اکسترودر' }],
    );
  });

  it('projects EquipmentRenamed as an Equipment Edited entry with the name before and after', async () => {
    const { projector, asPort } = fakeProjector();

    await new EquipmentRenamedAuditHandler(asPort).handle(
      new EquipmentRenamed('equipment-1', 'پرس', 'پرس هیدرولیک'),
    );

    expect(projector.project).toHaveBeenCalledWith(
      AuditRecordType.Equipment,
      'equipment-1',
      AuditAction.Edited,
      [{ field: 'name', previousValue: 'پرس', newValue: 'پرس هیدرولیک' }],
    );
  });

  it('projects EquipmentRetired as an Equipment Retired entry with its name', async () => {
    const { projector, asPort } = fakeProjector();

    await new EquipmentRetiredAuditHandler(asPort).handle(
      new EquipmentRetired('equipment-1', 'پرس'),
    );

    expect(projector.project).toHaveBeenCalledWith(
      AuditRecordType.Equipment,
      'equipment-1',
      AuditAction.Retired,
      [{ field: 'name', previousValue: 'پرس', newValue: '' }],
    );
  });

  it('projects MaintenanceActivityRegistered as a MaintenanceActivity Registered entry with its name', async () => {
    const { projector, asPort } = fakeProjector();

    await new MaintenanceActivityRegisteredAuditHandler(asPort).handle(
      new MaintenanceActivityRegistered('activity-1', 'تعویض روغن'),
    );

    expect(projector.project).toHaveBeenCalledWith(
      AuditRecordType.MaintenanceActivity,
      'activity-1',
      AuditAction.Registered,
      [{ field: 'name', previousValue: '', newValue: 'تعویض روغن' }],
    );
  });

  it('projects MaintenanceActivityRenamed as a MaintenanceActivity Edited entry with the name before and after', async () => {
    const { projector, asPort } = fakeProjector();

    await new MaintenanceActivityRenamedAuditHandler(asPort).handle(
      new MaintenanceActivityRenamed('activity-1', 'تعویض روغن', 'تعویض فیلتر'),
    );

    expect(projector.project).toHaveBeenCalledWith(
      AuditRecordType.MaintenanceActivity,
      'activity-1',
      AuditAction.Edited,
      [{ field: 'name', previousValue: 'تعویض روغن', newValue: 'تعویض فیلتر' }],
    );
  });

  it('projects PmPlanItemAdded as a PmPlanItem Registered entry with its equipment, activity and schedule', async () => {
    const { projector, asPort } = fakeProjector();

    await new PmPlanItemAddedAuditHandler(asPort).handle(
      new PmPlanItemAdded(
        'equipment-1',
        'اکسترودر',
        'item-1',
        'activity-1',
        'تعویض روغن',
        30,
        '2026-07-01',
      ),
    );

    expect(projector.project).toHaveBeenCalledWith(
      AuditRecordType.PmPlanItem,
      'item-1',
      AuditAction.Registered,
      [
        { field: 'equipment', previousValue: '', newValue: 'اکسترودر' },
        { field: 'activity', previousValue: '', newValue: 'تعویض روغن' },
        { field: 'intervalDays', previousValue: '', newValue: '30' },
        { field: 'firstDueDate', previousValue: '', newValue: '2026-07-01' },
      ],
    );
  });

  it('projects PmPlanItemIntervalChanged as a PmPlanItem Edited entry, its equipment and activity as the subject', async () => {
    const { projector, asPort } = fakeProjector();

    await new PmPlanItemIntervalChangedAuditHandler(asPort).handle(
      new PmPlanItemIntervalChanged(
        'equipment-1',
        'اکسترودر',
        'item-1',
        'تعویض روغن',
        30,
        15,
        '2026-07-01',
      ),
    );

    expect(projector.project).toHaveBeenCalledWith(
      AuditRecordType.PmPlanItem,
      'item-1',
      AuditAction.Edited,
      [{ field: 'intervalDays', previousValue: '30', newValue: '15' }],
      { field: 'pmPlanItem', value: 'اکسترودر: تعویض روغن' },
    );
  });

  it('projects PmPlanItemRemoved as a PmPlanItem Deleted entry with its equipment and activity', async () => {
    const { projector, asPort } = fakeProjector();

    await new PmPlanItemRemovedAuditHandler(asPort).handle(
      new PmPlanItemRemoved('equipment-1', 'اکسترودر', 'item-1', 'تعویض روغن'),
    );

    expect(projector.project).toHaveBeenCalledWith(
      AuditRecordType.PmPlanItem,
      'item-1',
      AuditAction.Deleted,
      [
        { field: 'equipment', previousValue: 'اکسترودر', newValue: '' },
        { field: 'activity', previousValue: 'تعویض روغن', newValue: '' },
      ],
    );
  });

  it('projects MaintenanceExecutionRecorded as a MaintenanceExecution Registered entry', async () => {
    const { projector, asPort } = fakeProjector();

    await new MaintenanceExecutionRecordedAuditHandler(asPort).handle(
      new MaintenanceExecutionRecorded(
        'execution-1',
        'equipment-1',
        'اکسترودر',
        'item-1',
        'تعویض روغن',
        '2026-07-01',
        new Date('2026-07-01T05:30:00.000Z'),
        'مسلمی',
        'فیلتر هم عوض شد',
      ),
    );

    expect(projector.project).toHaveBeenCalledWith(
      AuditRecordType.MaintenanceExecution,
      'execution-1',
      AuditAction.Registered,
      [
        { field: 'equipment', previousValue: '', newValue: 'اکسترودر' },
        { field: 'activity', previousValue: '', newValue: 'تعویض روغن' },
        { field: 'dueDate', previousValue: '', newValue: '2026-07-01' },
        {
          field: 'performedAt',
          previousValue: '',
          newValue: '2026-07-01T05:30:00.000Z',
        },
        { field: 'performedBy', previousValue: '', newValue: 'مسلمی' },
        { field: 'notes', previousValue: '', newValue: 'فیلتر هم عوض شد' },
      ],
    );
  });

  it('leaves an execution without notes without a notes line', async () => {
    const { projector, asPort } = fakeProjector();

    await new MaintenanceExecutionRecordedAuditHandler(asPort).handle(
      new MaintenanceExecutionRecorded(
        'execution-1',
        'equipment-1',
        'اکسترودر',
        'item-1',
        'تعویض روغن',
        '2026-07-01',
        new Date('2026-07-01T05:30:00.000Z'),
        'مسلمی',
        null,
      ),
    );

    const changes = (
      projector.project.mock.calls[0] as [
        unknown,
        unknown,
        unknown,
        { field: string }[],
      ]
    )[3];
    expect(changes.map((change) => change.field)).not.toContain('notes');
  });
});
