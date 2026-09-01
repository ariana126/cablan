import {
  AuditAction,
  AuditRecordType,
} from '@audit-logging/application/service/audit-log.repository';
import { AuditLogProjector } from '@audit-logging/application/service/audit-log-projector.service';
import { MaterialDeleted } from '@materials/domain/events/material-deleted.event';
import { MaterialRegistered } from '@materials/domain/events/material-registered.event';
import { MaterialRenamed } from '@materials/domain/events/material-renamed.event';

import { MaterialDeletedAuditHandler } from './material-deleted.handler';
import { MaterialRegisteredAuditHandler } from './material-registered.handler';
import { MaterialRenamedAuditHandler } from './material-renamed.handler';

function fakeProjector() {
  return { project: jest.fn().mockResolvedValue() };
}

describe('materials audit handlers', () => {
  it('projects a MaterialRegistered event as a Material Registered entry', async () => {
    const projector = fakeProjector();
    const sut = new MaterialRegisteredAuditHandler(
      projector as unknown as AuditLogProjector,
    );

    await sut.handle(new MaterialRegistered('material-1', 'Copper'));

    expect(projector.project).toHaveBeenCalledWith(
      AuditRecordType.Material,
      'material-1',
      AuditAction.Registered,
    );
  });

  it("projects a MaterialRenamed event as a Material Edited entry with the 'name' field's before/after", async () => {
    const projector = fakeProjector();
    const sut = new MaterialRenamedAuditHandler(
      projector as unknown as AuditLogProjector,
    );

    await sut.handle(new MaterialRenamed('material-1', 'Copper', 'Steel'));

    expect(projector.project).toHaveBeenCalledWith(
      AuditRecordType.Material,
      'material-1',
      AuditAction.Edited,
      [{ field: 'name', previousValue: 'Copper', newValue: 'Steel' }],
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
