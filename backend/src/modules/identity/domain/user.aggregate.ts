import { AggregateRoot, Identity, Role } from '@framework/domain';

import { UserDeleted } from './events/user-deleted.event';
import { UserPasswordChanged } from './events/user-password-changed.event';
import { UserRegistered } from './events/user-registered.event';
import { UserRenamed } from './events/user-renamed.event';
import { UserRoleChanged } from './events/user-role-changed.event';
import { UsernameChanged } from './events/username-changed.event';
import { Username } from './value/username.vo';

export class User extends AggregateRoot {
  private constructor(
    id: Identity,
    private name: string,
    private _username: Username,
    private _passwordHash: string,
    private _role: Role,
    private isDeleted: boolean,
  ) {
    super(id);
  }

  public static register(
    name: string,
    username: Username,
    passwordHash: string,
    role: Role,
  ): User {
    const user = new User(
      Identity.new(),
      name,
      username,
      passwordHash,
      role,
      false,
    );
    user.recordThat(
      new UserRegistered(user.id.asString(), username.asString(), role),
    );
    return user;
  }

  /**
   * Rehydrates a `User` from storage — for `PrismaUserRepository`'s
   * `toDomain()` only. Unlike `register()`, this records no event: loading an
   * existing row is not a new business fact.
   */
  public static fromPersistence(
    id: Identity,
    name: string,
    username: Username,
    passwordHash: string,
    role: Role,
    isDeleted: boolean,
  ): User {
    return new User(id, name, username, passwordHash, role, isDeleted);
  }

  public rename(name: string): void {
    const previousName = this.name;
    this.name = name;
    this.recordThat(new UserRenamed(this.id.asString(), previousName, name));
  }

  public changeUsername(username: Username): void {
    const previousUsername = this._username;
    this._username = username;
    this.recordThat(
      new UsernameChanged(
        this.id.asString(),
        previousUsername.asString(),
        username.asString(),
      ),
    );
  }

  public changePassword(passwordHash: string): void {
    this._passwordHash = passwordHash;
    this.recordThat(new UserPasswordChanged(this.id.asString()));
  }

  public changeRole(role: Role): void {
    const previousRole = this._role;
    this._role = role;
    this.recordThat(
      new UserRoleChanged(this.id.asString(), previousRole, role),
    );
  }

  /**
   * Soft delete: the row stays — other data this user registered (e.g. BOM
   * records) may still reference it, so it must remain resolvable for
   * referential and audit integrity. The repository persists this through
   * the ordinary `save()` upsert; there is no separate delete on the port.
   */
  public delete(): void {
    this.isDeleted = true;
    this.recordThat(
      new UserDeleted(this.id.asString(), this._username.asString()),
    );
  }

  public deleted(): boolean {
    return this.isDeleted;
  }

  public displayName(): string {
    return this.name;
  }

  public username(): Username {
    return this._username;
  }

  public passwordHash(): string {
    return this._passwordHash;
  }

  public role(): Role {
    return this._role;
  }
}
