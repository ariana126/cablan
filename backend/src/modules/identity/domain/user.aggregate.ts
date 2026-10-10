import { AggregateRoot, Identity, Role } from '@framework/domain';

import { UserDeleted } from './events/user-deleted.event';
import { UserEdited, UserFieldChange } from './events/user-edited.event';
import { UserPasswordChanged } from './events/user-password-changed.event';
import { UserRegistered } from './events/user-registered.event';
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

  /**
   * Applies an edit of the user's own fields (`undefined` = leave as is) and
   * records exactly one `UserEdited` event carrying only the fields whose
   * value actually changed. A field resent with its current value is not a
   * change, and an edit that changes nothing records no event at all — so
   * one update never yields several audit entries, nor a "Ariana -> Ariana"
   * line.
   */
  public edit(fields: {
    name?: string;
    username?: Username;
    role?: Role;
  }): void {
    const changes: UserFieldChange[] = [];

    if (fields.name !== undefined && fields.name !== this.name) {
      changes.push({
        field: 'name',
        previousValue: this.name,
        newValue: fields.name,
      });
      this.name = fields.name;
    }

    if (
      fields.username !== undefined &&
      !fields.username.equals(this._username)
    ) {
      changes.push({
        field: 'username',
        previousValue: this._username.asString(),
        newValue: fields.username.asString(),
      });
      this._username = fields.username;
    }

    if (fields.role !== undefined && fields.role !== this._role) {
      changes.push({
        field: 'role',
        previousValue: this._role,
        newValue: fields.role,
      });
      this._role = fields.role;
    }

    if (changes.length > 0) {
      this.recordThat(new UserEdited(this.id.asString(), changes));
    }
  }

  public changePassword(passwordHash: string): void {
    this._passwordHash = passwordHash;
    this.recordThat(new UserPasswordChanged(this.id.asString()));
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
