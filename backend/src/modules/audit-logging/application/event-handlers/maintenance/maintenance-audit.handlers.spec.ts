import {
  AuditAction,
  AuditRecordType,
} from '@audit-logging/application/service/audit-log.repository';
import { AuditLogProjector } from '@audit-logging/application/service/audit-log-projector.service';
import { EquipmentRegistered } from '@maintenance/domain/events/equipment-registered.event';
import { EquipmentRenamed } from '@maintenance/domain/events/equipment-renamed.event';
import { EquipmentRetired } from '@maintenance/domain/events/equipment-retired.event';
import { MaintenanceActivityEdited } from '@maintenance/domain/events/maintenance-activity-edited.event';
import { MaintenanceActivityRegistered } from '@maintenance/domain/events/maintenance-activity-registered.event';
import { MaintenanceActivitySpecialtyAssigned } from '@maintenance/domain/events/maintenance-activity-specialty-assigned.event';
import { MaintenanceExecutionRecorded } from '@maintenance/domain/events/maintenance-execution-recorded.event';
import { PmPlanItemAdded } from '@maintenance/domain/events/pm-plan-item-added.event';
import { PmPlanItemDeactivated } from '@maintenance/domain/events/pm-plan-item-deactivated.event';
import { PmPlanItemIntervalChanged } from '@maintenance/domain/events/pm-plan-item-interval-changed.event';

import { EquipmentRegisteredAuditHandler } from './equipment-registered.handler';
import { EquipmentRenamedAuditHandler } from './equipment-renamed.handler';
import { EquipmentRetiredAuditHandler } from './equipment-retired.handler';
import { MaintenanceActivityEditedAuditHandler } from './maintenance-activity-edited.handler';
import { MaintenanceActivityRegisteredAuditHandler } from './maintenance-activity-registered.handler';
import { MaintenanceActivitySpecialtyAssignedAuditHandler } from './maintenance-activity-specialty-assigned.handler';
import { MaintenanceExecutionRecordedAuditHandler } from './maintenance-execution-recorded.handler';
import { PmPlanItemAddedAuditHandler } from './pm-plan-item-added.handler';
import { PmPlanItemDeactivatedAuditHandler } from './pm-plan-item-deactivated.handler';
import { PmPlanItemIntervalChangedAuditHandler } from './pm-plan-item-interval-changed.handler';

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

  it('projects MaintenanceActivityRegistered as a MaintenanceActivity Registered entry with its name and specialty', async () => {
    const { projector, asPort } = fakeProjector();

    await new MaintenanceActivityRegisteredAuditHandler(asPort).handle(
      new MaintenanceActivityRegistered(
        'activity-1',
        'تعویض روغن',
        'mechanical',
      ),
    );

    expect(projector.project).toHaveBeenCalledWith(
      AuditRecordType.MaintenanceActivity,
      'activity-1',
      AuditAction.Registered,
      [
        { field: 'name', previousValue: '', newValue: 'تعویض روغن' },
        { field: 'specialty', previousValue: '', newValue: 'mechanical' },
      ],
    );
  });

  it('projects MaintenanceActivityEdited renaming it as one Edited entry with its name line and no subject', async () => {
    const { projector, asPort } = fakeProjector();

    await new MaintenanceActivityEditedAuditHandler(asPort).handle(
      new MaintenanceActivityEdited('activity-1', 'تعویض فیلتر', [
        { field: 'name', previousValue: 'تعویض روغن', newValue: 'تعویض فیلتر' },
      ]),
    );

    expect(projector.project).toHaveBeenCalledWith(
      AuditRecordType.MaintenanceActivity,
      'activity-1',
      AuditAction.Edited,
      [{ field: 'name', previousValue: 'تعویض روغن', newValue: 'تعویض فیلتر' }],
      null,
    );
  });

  it('projects MaintenanceActivityEdited changing only its specialty with the activity as subject', async () => {
    const { projector, asPort } = fakeProjector();

    await new MaintenanceActivityEditedAuditHandler(asPort).handle(
      new MaintenanceActivityEdited('activity-1', 'تعویض روغن', [
        { field: 'specialty', previousValue: '', newValue: 'electrical' },
      ]),
    );

    expect(projector.project).toHaveBeenCalledWith(
      AuditRecordType.MaintenanceActivity,
      'activity-1',
      AuditAction.Edited,
      [{ field: 'specialty', previousValue: '', newValue: 'electrical' }],
      { field: 'name', value: 'تعویض روغن' },
    );
  });

  it('projects MaintenanceActivityEdited changing both as one entry, the two lines in order', async () => {
    const { projector, asPort } = fakeProjector();
    const changes = [
      {
        field: 'name' as const,
        previousValue: 'تعویض روغن',
        newValue: 'بازرسی تابلو',
      },
      {
        field: 'specialty' as const,
        previousValue: 'mechanical',
        newValue: 'electrical',
      },
    ];

    await new MaintenanceActivityEditedAuditHandler(asPort).handle(
      new MaintenanceActivityEdited('activity-1', 'بازرسی تابلو', changes),
    );

    expect(projector.project).toHaveBeenCalledTimes(1);
    expect(projector.project).toHaveBeenCalledWith(
      AuditRecordType.MaintenanceActivity,
      'activity-1',
      AuditAction.Edited,
      changes,
      null,
    );
  });

  it('projects MaintenanceActivitySpecialtyAssigned as a MaintenanceActivity Edited entry giving it its specialty, the activity as subject', async () => {
    const { projector, asPort } = fakeProjector();

    await new MaintenanceActivitySpecialtyAssignedAuditHandler(asPort).handle(
      new MaintenanceActivitySpecialtyAssigned(
        'activity-1',
        'تعویض روغن',
        'mechanical',
      ),
    );

    expect(projector.project).toHaveBeenCalledWith(
      AuditRecordType.MaintenanceActivity,
      'activity-1',
      AuditAction.Edited,
      [{ field: 'specialty', previousValue: '', newValue: 'mechanical' }],
      { field: 'name', value: 'تعویض روغن' },
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

  it('projects PmPlanItemDeactivated as a PmPlanItem Deactivated entry with its equipment and activity', async () => {
    const { projector, asPort } = fakeProjector();

    await new PmPlanItemDeactivatedAuditHandler(asPort).handle(
      new PmPlanItemDeactivated(
        'equipment-1',
        'اکسترودر',
        'item-1',
        'تعویض روغن',
      ),
    );

    expect(projector.project).toHaveBeenCalledWith(
      AuditRecordType.PmPlanItem,
      'item-1',
      AuditAction.Deactivated,
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
        1250.5,
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
        { field: 'operatingHours', previousValue: '', newValue: '1250.5' },
      ],
    );
  });

  it('leaves an execution without notes or operating hours without either line', async () => {
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
    expect(changes.map((change) => change.field)).not.toContain(
      'operatingHours',
    );
  });
});
