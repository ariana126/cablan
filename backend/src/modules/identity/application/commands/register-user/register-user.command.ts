import { Role } from '@framework/domain';
import { Username } from '@identity/domain/value/username.vo';

export class RegisterUserCommand {
  constructor(
    public readonly name: string,
    public readonly username: Username,
    public readonly password: string,
    public readonly role: Role,
  ) {}
}
