import { Username } from '@identity/domain/value/username.vo';

export class LoginCommand {
  constructor(
    public readonly username: Username,
    public readonly password: string,
  ) {}
}
