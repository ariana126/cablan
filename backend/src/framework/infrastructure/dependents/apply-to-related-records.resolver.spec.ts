import { Identity, Role, UserRoleProvider } from '@framework/domain';

import { AuthenticatedUser } from '../http/decorators/authenticated-user';
import { ApplyToRelatedRecordsResolver } from './apply-to-related-records.resolver';

class StubRoles extends UserRoleProvider {
  readonly asked: string[] = [];

  constructor(private readonly role: Role | null) {
    super();
  }

  getRole(userId: Identity): Promise<Role | null> {
    this.asked.push(userId.asString());
    return Promise.resolve(this.role);
  }
}

const caller = new AuthenticatedUser(Identity.fromString('user-1'));

describe('ApplyToRelatedRecordsResolver', () => {
  it('grants it to a caller who asks while a System Admin now', async () => {
    const sut = new ApplyToRelatedRecordsResolver(
      new StubRoles(Role.SystemAdmin),
    );

    const asked = await sut.askedBy(caller, true);

    expect(asked.isGranted()).toBe(true);
  });

  it('silently grants it to no one else who asks', async () => {
    const sut = new ApplyToRelatedRecordsResolver(
      new StubRoles(Role.TechnicalManager),
    );

    const asked = await sut.askedBy(caller, true);

    expect(asked.isGranted()).toBe(false);
  });

  it('looks up no role when not asked', async () => {
    const roles = new StubRoles(Role.SystemAdmin);
    const sut = new ApplyToRelatedRecordsResolver(roles);

    for (const asked of [false, undefined]) {
      const resolved = await sut.askedBy(caller, asked);
      expect(resolved.isGranted()).toBe(false);
    }
    expect(roles.asked).toEqual([]);
  });
});
