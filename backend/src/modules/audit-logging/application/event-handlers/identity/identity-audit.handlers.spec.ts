import {
  AuditAction,
  AuditRecordType,
} from '@audit-logging/application/service/audit-log.repository';
import { AuditLogProjector } from '@audit-logging/application/service/audit-log-projector.service';
import { Role } from '@framework/domain';
import { UserDeleted } from '@identity/domain/events/user-deleted.event';
import { UserRegistered } from '@identity/domain/events/user-registered.event';
import { UserRenamed } from '@identity/domain/events/user-renamed.event';
import { UserRoleChanged } from '@identity/domain/events/user-role-changed.event';
import { UsernameChanged } from '@identity/domain/events/username-changed.event';

import { UserDeletedAuditHandler } from './user-deleted.handler';
import { UserRegisteredAuditHandler } from './user-registered.handler';
import { UserRenamedAuditHandler } from './user-renamed.handler';
import { UserRoleChangedAuditHandler } from './user-role-changed.handler';
import { UsernameChangedAuditHandler } from './username-changed.handler';

function fakeProjector() {
  return { project: jest.fn().mockResolvedValue() };
}

describe('identity audit handlers', () => {
  it('projects a UserRegistered event as a User Registered entry with no changes', async () => {
    const projector = fakeProjector();
    const sut = new UserRegisteredAuditHandler(
      projector as unknown as AuditLogProjector,
    );

    await sut.handle(new UserRegistered('user-1', 'sina.q', Role.SystemAdmin));

    expect(projector.project).toHaveBeenCalledWith(
      AuditRecordType.User,
      'user-1',
      AuditAction.Registered,
    );
  });

  it('projects a UserDeleted event as a User Deleted entry with no changes', async () => {
    const projector = fakeProjector();
    const sut = new UserDeletedAuditHandler(
      projector as unknown as AuditLogProjector,
    );

    await sut.handle(new UserDeleted('user-1', 'sina.q'));

    expect(projector.project).toHaveBeenCalledWith(
      AuditRecordType.User,
      'user-1',
      AuditAction.Deleted,
    );
  });

  it("projects a UserRenamed event as a User Edited entry with the 'name' field's before/after", async () => {
    const projector = fakeProjector();
    const sut = new UserRenamedAuditHandler(
      projector as unknown as AuditLogProjector,
    );

    await sut.handle(new UserRenamed('user-1', 'Nikrooz', 'Nik'));

    expect(projector.project).toHaveBeenCalledWith(
      AuditRecordType.User,
      'user-1',
      AuditAction.Edited,
      [{ field: 'name', previousValue: 'Nikrooz', newValue: 'Nik' }],
    );
  });

  it("projects a UsernameChanged event as a User Edited entry with the 'username' field's before/after", async () => {
    const projector = fakeProjector();
    const sut = new UsernameChangedAuditHandler(
      projector as unknown as AuditLogProjector,
    );

    await sut.handle(new UsernameChanged('user-1', 'sina.q', 'sina.g'));

    expect(projector.project).toHaveBeenCalledWith(
      AuditRecordType.User,
      'user-1',
      AuditAction.Edited,
      [{ field: 'username', previousValue: 'sina.q', newValue: 'sina.g' }],
    );
  });

  it("projects a UserRoleChanged event as a User Edited entry with the 'role' field's before/after", async () => {
    const projector = fakeProjector();
    const sut = new UserRoleChangedAuditHandler(
      projector as unknown as AuditLogProjector,
    );

    await sut.handle(
      new UserRoleChanged('user-1', Role.Reporter, Role.QcInspector),
    );

    expect(projector.project).toHaveBeenCalledWith(
      AuditRecordType.User,
      'user-1',
      AuditAction.Edited,
      [
        {
          field: 'role',
          previousValue: Role.Reporter,
          newValue: Role.QcInspector,
        },
      ],
    );
  });
});
