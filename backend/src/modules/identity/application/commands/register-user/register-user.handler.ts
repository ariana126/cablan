import { UsernameAlreadyExists } from '@identity/application/exceptions';
import { PasswordHasher } from '@identity/domain/service/password-hasher';
import { UserRepository } from '@identity/domain/service/user.repository';
import { User } from '@identity/domain/user.aggregate';
import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';

import { RegisterUserCommand } from './register-user.command';

@CommandHandler(RegisterUserCommand)
export class RegisterUserHandler implements ICommandHandler<
  RegisterUserCommand,
  { id: string }
> {
  constructor(
    private readonly userRepository: UserRepository,
    private readonly passwordHasher: PasswordHasher,
  ) {}

  async execute(command: RegisterUserCommand): Promise<{ id: string }> {
    const existingUser = await this.userRepository.findByUsername(
      command.username,
    );
    if (existingUser) {
      throw UsernameAlreadyExists.withUsername(command.username);
    }

    const hashedPassword = await this.passwordHasher.hash(command.password);
    const user = User.register(
      command.name,
      command.username,
      hashedPassword,
      command.role,
    );
    await this.userRepository.save(user);

    return { id: user.id.asString() };
  }
}
