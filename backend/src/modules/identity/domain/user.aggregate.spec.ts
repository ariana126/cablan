import { Identity, Role } from '@framework/domain';

import { UserDeleted } from './events/user-deleted.event';
import { UserEdited } from './events/user-edited.event';
import { UserPasswordChanged } from './events/user-password-changed.event';
import { UserRegistered } from './events/user-registered.event';
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

  it('editing a user changes its fields and records one UserEdited event carrying every changed field', () => {
    const sut = registerUser();
    sut.releaseEvents();

    sut.edit({
      name: 'Sina Q.',
      username: Username.fromString('sina.ghadrdan'),
      role: Role.Management,
    });

    expect(sut.displayName()).toBe('Sina Q.');
    expect(sut.username().asString()).toBe('sina.ghadrdan');
    expect(sut.role()).toBe(Role.Management);
    expect(sut.releaseEvents()).toEqual([
      new UserEdited(sut.id.asString(), [
        {
          field: 'name',
          previousValue: 'Sina Ghadrdan',
          newValue: 'Sina Q.',
        },
        {
          field: 'username',
          previousValue: 'sina.q',
          newValue: 'sina.ghadrdan',
        },
        {
          field: 'role',
          previousValue: Role.QcInspector,
          newValue: Role.Management,
        },
      ]),
    ]);
  });

  it('editing a user with a name equal to its current one records no event', () => {
    const sut = registerUser();
    sut.releaseEvents();

    sut.edit({ name: 'Sina Ghadrdan' });

    expect(sut.releaseEvents()).toEqual([]);
  });

  it('editing a user omits the fields resent unchanged from the recorded changes', () => {
    const sut = registerUser();
    sut.releaseEvents();

    sut.edit({
      name: 'Sina Ghadrdan',
      username: Username.fromString('sina.q'),
      role: Role.Management,
    });

    expect(sut.releaseEvents()).toEqual([
      new UserEdited(sut.id.asString(), [
        {
          field: 'role',
          previousValue: Role.QcInspector,
          newValue: Role.Management,
        },
      ]),
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
