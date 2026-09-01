import {
  AuditAction,
  AuditRecordType,
} from '@audit-logging/application/service/audit-log.repository';
import { AuditLogProjector } from '@audit-logging/application/service/audit-log-projector.service';
import { ComponentDeleted } from '@components/domain/events/component-deleted.event';
import { ComponentRegistered } from '@components/domain/events/component-registered.event';
import { ComponentRenamed } from '@components/domain/events/component-renamed.event';

import { ComponentDeletedAuditHandler } from './component-deleted.handler';
import { ComponentRegisteredAuditHandler } from './component-registered.handler';
import { ComponentRenamedAuditHandler } from './component-renamed.handler';

function fakeProjector() {
  return { project: jest.fn().mockResolvedValue() };
}

describe('components audit handlers', () => {
  it('projects a ComponentRegistered event as a Component Registered entry', async () => {
    const projector = fakeProjector();
    const sut = new ComponentRegisteredAuditHandler(
      projector as unknown as AuditLogProjector,
    );

    await sut.handle(new ComponentRegistered('component-1', 'Bolt'));

    expect(projector.project).toHaveBeenCalledWith(
      AuditRecordType.Component,
      'component-1',
      AuditAction.Registered,
    );
  });

  it("projects a ComponentRenamed event as a Component Edited entry with the 'name' field's before/after", async () => {
    const projector = fakeProjector();
    const sut = new ComponentRenamedAuditHandler(
      projector as unknown as AuditLogProjector,
    );

    await sut.handle(new ComponentRenamed('component-1', 'Bolt', 'Nut'));

    expect(projector.project).toHaveBeenCalledWith(
      AuditRecordType.Component,
      'component-1',
      AuditAction.Edited,
      [{ field: 'name', previousValue: 'Bolt', newValue: 'Nut' }],
    );
  });

  it('projects a ComponentDeleted event as a Component Deleted entry', async () => {
    const projector = fakeProjector();
    const sut = new ComponentDeletedAuditHandler(
      projector as unknown as AuditLogProjector,
    );

    await sut.handle(new ComponentDeleted('component-1', 'Bolt'));

    expect(projector.project).toHaveBeenCalledWith(
      AuditRecordType.Component,
      'component-1',
      AuditAction.Deleted,
    );
  });
});
