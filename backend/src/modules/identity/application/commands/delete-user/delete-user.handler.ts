import { UserRepository } from '@identity/domain/service/user.repository';
import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';

import { DeleteUserCommand } from './delete-user.command';

@CommandHandler(DeleteUserCommand)
export class DeleteUserHandler implements ICommandHandler<DeleteUserCommand> {
  constructor(private readonly userRepository: UserRepository) {}

  async execute(command: DeleteUserCommand): Promise<void> {
    const user = await this.userRepository.get(command.userId);
    user.delete();
    // Soft delete: `save()` persists the flag through the ordinary upsert —
    // the row stays, since other data this user registered (e.g. BOM
    // records) may still reference it.
    await this.userRepository.save(user);
  }
}
