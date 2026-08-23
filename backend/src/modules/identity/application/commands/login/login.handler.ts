import { InvalidCredentials } from '@identity/application/exceptions';
import { AccessTokenIssuer } from '@identity/domain/service/access-token-issuer';
import { PasswordHasher } from '@identity/domain/service/password-hasher';
import { UserRepository } from '@identity/domain/service/user.repository';
import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';

import { LoginCommand } from './login.command';

@CommandHandler(LoginCommand)
export class LoginHandler implements ICommandHandler<LoginCommand> {
  constructor(
    private readonly userRepository: UserRepository,
    private readonly passwordHasher: PasswordHasher,
    private readonly accessTokenIssuer: AccessTokenIssuer,
  ) {}

  async execute(command: LoginCommand): Promise<{ accessToken: string }> {
    // `findByUsername` already excludes soft-deleted users, so a deleted
    // account falls into this same branch as an unknown one — both produce
    // the same generic InvalidCredentials, matching the login feature.
    const user = await this.userRepository.findByUsername(command.username);
    if (!user) {
      throw InvalidCredentials.provided();
    }

    const passwordMatches = await this.passwordHasher.compare(
      command.password,
      user.passwordHash(),
    );
    if (!passwordMatches) {
      throw InvalidCredentials.provided();
    }

    const accessToken = this.accessTokenIssuer.issue({
      sub: user.id.asString(),
    });

    return { accessToken };
  }
}
