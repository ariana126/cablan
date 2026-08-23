import { Identity, Role } from '@framework/domain';

import { UserDeleted } from './events/user-deleted.event';
import { UserPasswordChanged } from './events/user-password-changed.event';
import { UserRegistered } from './events/user-registered.event';
import { UserRenamed } from './events/user-renamed.event';
import { UserRoleChanged } from './events/user-role-changed.event';
import { UsernameChanged } from './events/username-changed.event';
import { User } from './user.aggregate';
import { Username } from './value/username.vo';

function registerUser(): User {
  return User.register(
    'Sina Ghadrdan',
    Username.fromString('sina.q'),
    'hashed-password',
    Role.QcInspector,
  );
}

describe('User', () => {
  it('registering a user sets its fields', () => {
    const sut = registerUser();

    expect(sut.displayName()).toBe('Sina Ghadrdan');
    expect(sut.username().asString()).toBe('sina.q');
    expect(sut.passwordHash()).toBe('hashed-password');
    expect(sut.role()).toBe(Role.QcInspector);
    expect(sut.deleted()).toBe(false);
  });

  it('registering a user records a UserRegistered event', () => {
    const sut = registerUser();

    const events = sut.releaseEvents();

    expect(events).toEqual([
      new UserRegistered(sut.id.asString(), 'sina.q', Role.QcInspector),
    ]);
  });

  it('renaming a user changes its name and records a UserRenamed event', () => {
    const sut = registerUser();
    sut.releaseEvents();

    sut.rename('Sina Q.');

    expect(sut.displayName()).toBe('Sina Q.');
    expect(sut.releaseEvents()).toEqual([
      new UserRenamed(sut.id.asString(), 'Sina Ghadrdan', 'Sina Q.'),
    ]);
  });

  it('changing a username records a UsernameChanged event', () => {
    const sut = registerUser();
    sut.releaseEvents();

    sut.changeUsername(Username.fromString('sina.ghadrdan'));

    expect(sut.username().asString()).toBe('sina.ghadrdan');
    expect(sut.releaseEvents()).toEqual([
      new UsernameChanged(sut.id.asString(), 'sina.q', 'sina.ghadrdan'),
    ]);
  });

  it('changing a password records a UserPasswordChanged event with no password material', () => {
    const sut = registerUser();
    sut.releaseEvents();

    sut.changePassword('new-hashed-password');

    expect(sut.passwordHash()).toBe('new-hashed-password');
    expect(sut.releaseEvents()).toEqual([
      new UserPasswordChanged(sut.id.asString()),
    ]);
  });

  it('changing a role records a UserRoleChanged event', () => {
    const sut = registerUser();
    sut.releaseEvents();

    sut.changeRole(Role.Management);

    expect(sut.role()).toBe(Role.Management);
    expect(sut.releaseEvents()).toEqual([
      new UserRoleChanged(sut.id.asString(), Role.QcInspector, Role.Management),
    ]);
  });

  it('deleting a user marks it deleted and records a UserDeleted event', () => {
    const sut = registerUser();
    sut.releaseEvents();

    sut.delete();

    expect(sut.deleted()).toBe(true);
    expect(sut.releaseEvents()).toEqual([
      new UserDeleted(sut.id.asString(), 'sina.q'),
    ]);
  });

  it('reconstructing a user from persistence records no event', () => {
    const id = Identity.new();

    const sut = User.fromPersistence(
      id,
      'Sina Ghadrdan',
      Username.fromString('sina.q'),
      'hashed-password',
      Role.QcInspector,
      true,
    );

    expect(sut.id.equals(id)).toBe(true);
    expect(sut.deleted()).toBe(true);
    expect(sut.releaseEvents()).toEqual([]);
  });
});
