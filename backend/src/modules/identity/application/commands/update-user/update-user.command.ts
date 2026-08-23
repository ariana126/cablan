import { Identity, Role } from '@framework/domain';
import { Username } from '@identity/domain/value/username.vo';

export class UpdateUserCommand {
  constructor(
    public readonly userId: Identity,
    public readonly actingUserId: Identity,
    public readonly name?: string,
    public readonly username?: Username,
    public readonly password?: string,
    public readonly role?: Role,
  ) {}
}
