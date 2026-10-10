import {
  CannotChangeOwnRole,
  UsernameAlreadyExists,
} from '@identity/application/exceptions';
import { PasswordHasher } from '@identity/domain/service/password-hasher';
import { UserRepository } from '@identity/domain/service/user.repository';
import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';

import { UpdateUserCommand } from './update-user.command';

@CommandHandler(UpdateUserCommand)
export class UpdateUserHandler implements ICommandHandler<UpdateUserCommand> {
  constructor(
    private readonly userRepository: UserRepository,
    private readonly passwordHasher: PasswordHasher,
  ) {}

  async execute(command: UpdateUserCommand): Promise<void> {
    // Checked before anything is loaded: a system admin editing their own
    // role must leave the account entirely untouched, not just the role.
    if (
      command.role !== undefined &&
      command.userId.equals(command.actingUserId)
    ) {
      throw CannotChangeOwnRole.attempted(command.actingUserId);
    }

    const user = await this.userRepository.get(command.userId);

    if (command.username !== undefined) {
      const existingUser = await this.userRepository.findByUsername(
        command.username,
      );
      if (existingUser && !existingUser.id.equals(user.id)) {
        throw UsernameAlreadyExists.withUsername(command.username);
      }
    }

    if (command.password !== undefined) {
      const hashedPassword = await this.passwordHasher.hash(command.password);
      user.changePassword(hashedPassword);
    }

    user.edit({
      name: command.name,
      username: command.username,
      role: command.role,
    });

    await this.userRepository.save(user);
  }
}
