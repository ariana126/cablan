import {
  AuditAction,
  AuditRecordType,
} from '@audit-logging/application/service/audit-log.repository';
import { AuditLogProjector } from '@audit-logging/application/service/audit-log-projector.service';
import { Role } from '@framework/domain';
import { UserDeleted } from '@identity/domain/events/user-deleted.event';
import { UserEdited } from '@identity/domain/events/user-edited.event';
import { UserRegistered } from '@identity/domain/events/user-registered.event';

import { UserDeletedAuditHandler } from './user-deleted.handler';
import { UserEditedAuditHandler } from './user-edited.handler';
import { UserRegisteredAuditHandler } from './user-registered.handler';

function fakeProjector() {
  return { project: jest.fn().mockResolvedValue() };
}

describe('identity audit handlers', () => {
  it('projects a UserRegistered event as a User Registered entry showing its name, username and role', async () => {
    const projector = fakeProjector();
    const sut = new UserRegisteredAuditHandler(
      projector as unknown as AuditLogProjector,
    );

    await sut.handle(
      new UserRegistered('user-1', 'Sina', 'sina.q', Role.SystemAdmin),
    );

    expect(projector.project).toHaveBeenCalledWith(
      AuditRecordType.User,
      'user-1',
      AuditAction.Registered,
      [
        { field: 'name', previousValue: '', newValue: 'Sina' },
        { field: 'username', previousValue: '', newValue: 'sina.q' },
        { field: 'role', previousValue: '', newValue: Role.SystemAdmin },
      ],
    );
  });

  it('projects a UserDeleted event as a User Deleted entry showing the deleted name, username and role', async () => {
    const projector = fakeProjector();
    const sut = new UserDeletedAuditHandler(
      projector as unknown as AuditLogProjector,
    );

    await sut.handle(
      new UserDeleted('user-1', 'Sina', 'sina.q', Role.Reporter),
    );

    expect(projector.project).toHaveBeenCalledWith(
      AuditRecordType.User,
      'user-1',
      AuditAction.Deleted,
      [
        { field: 'name', previousValue: 'Sina', newValue: '' },
        { field: 'username', previousValue: 'sina.q', newValue: '' },
        { field: 'role', previousValue: Role.Reporter, newValue: '' },
      ],
    );
  });

  it('projects a UserEdited event as one User Edited entry carrying every changed field', async () => {
    const projector = fakeProjector();
    const sut = new UserEditedAuditHandler(
      projector as unknown as AuditLogProjector,
    );
    const changes = [
      { field: 'name', previousValue: 'Nikrooz', newValue: 'Nik' },
      {
        field: 'role',
        previousValue: Role.Reporter,
        newValue: Role.QcInspector,
      },
    ];

    await sut.handle(new UserEdited('user-1', changes));

    expect(projector.project).toHaveBeenCalledTimes(1);
    expect(projector.project).toHaveBeenCalledWith(
      AuditRecordType.User,
      'user-1',
      AuditAction.Edited,
      changes,
    );
  });
});
