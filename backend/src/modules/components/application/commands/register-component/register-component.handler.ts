import { ComponentNameAlreadyExists } from '@components/application/exceptions';
import { Component } from '@components/domain/component.aggregate';
import { ComponentRepository } from '@components/domain/service/component.repository';
import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';

import { RegisterComponentCommand } from './register-component.command';

@CommandHandler(RegisterComponentCommand)
export class RegisterComponentHandler implements ICommandHandler<
  RegisterComponentCommand,
  { id: string }
> {
  constructor(private readonly componentRepository: ComponentRepository) {}

  async execute(command: RegisterComponentCommand): Promise<{ id: string }> {
    const existingComponent = await this.componentRepository.findByName(
      command.name,
    );
    if (existingComponent) {
      throw ComponentNameAlreadyExists.withName(command.name);
    }

    const component = Component.register(command.name);
    await this.componentRepository.save(component);

    return { id: component.id.asString() };
  }
}
