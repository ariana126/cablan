import {
  AuditAction,
  AuditRecordType,
} from '@audit-logging/application/service/audit-log.repository';
import { AuditLogProjector } from '@audit-logging/application/service/audit-log-projector.service';
import { MaterialDeleted } from '@materials/domain/events/material-deleted.event';
import { MaterialEdited } from '@materials/domain/events/material-edited.event';
import { MaterialRegistered } from '@materials/domain/events/material-registered.event';

import { MaterialDeletedAuditHandler } from './material-deleted.handler';
import { MaterialEditedAuditHandler } from './material-edited.handler';
import { MaterialRegisteredAuditHandler } from './material-registered.handler';

function fakeProjector() {
  return { project: jest.fn().mockResolvedValue() };
}

describe('materials audit handlers', () => {
  it('projects a MaterialRegistered event as a Material Registered entry', async () => {
    const projector = fakeProjector();
    const sut = new MaterialRegisteredAuditHandler(
      projector as unknown as AuditLogProjector,
    );

    await sut.handle(new MaterialRegistered('material-1', 'Copper', 'RM-001'));

    expect(projector.project).toHaveBeenCalledWith(
      AuditRecordType.Material,
      'material-1',
      AuditAction.Registered,
    );
  });

  it("projects a MaterialEdited event as one Material Edited entry carrying the event's own changes", async () => {
    const projector = fakeProjector();
    const sut = new MaterialEditedAuditHandler(
      projector as unknown as AuditLogProjector,
    );

    await sut.handle(
      new MaterialEdited('material-1', [
        { field: 'name', previousValue: 'Copper', newValue: 'Steel' },
        { field: 'code', previousValue: '', newValue: 'RM-001' },
      ]),
    );

    expect(projector.project).toHaveBeenCalledWith(
      AuditRecordType.Material,
      'material-1',
      AuditAction.Edited,
      [
        { field: 'name', previousValue: 'Copper', newValue: 'Steel' },
        { field: 'code', previousValue: '', newValue: 'RM-001' },
      ],
    );
  });

  it('projects a MaterialDeleted event as a Material Deleted entry', async () => {
    const projector = fakeProjector();
    const sut = new MaterialDeletedAuditHandler(
      projector as unknown as AuditLogProjector,
    );

    await sut.handle(new MaterialDeleted('material-1', 'Copper'));

    expect(projector.project).toHaveBeenCalledWith(
      AuditRecordType.Material,
      'material-1',
      AuditAction.Deleted,
    );
  });
});
