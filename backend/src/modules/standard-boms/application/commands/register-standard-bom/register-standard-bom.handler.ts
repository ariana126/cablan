import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { StandardBomMiCodeAlreadyExists } from '@standard-boms/application/exceptions';
import { StandardBomReadModel } from '@standard-boms/application/queries/list-standard-boms/standard-bom.read-model';
import { StandardBomCompositionFactory } from '@standard-boms/application/service/standard-bom-composition.factory';
import { StandardBomRepository } from '@standard-boms/domain/service/standard-bom.repository';
import { StandardBom } from '@standard-boms/domain/standard-bom.aggregate';

import { assertCompositionInvariants } from '../assert-composition-invariants';
import { RegisterStandardBomCommand } from './register-standard-bom.command';

@CommandHandler(RegisterStandardBomCommand)
export class RegisterStandardBomHandler implements ICommandHandler<
  RegisterStandardBomCommand,
  StandardBomReadModel
> {
  constructor(
    private readonly standardBomRepository: StandardBomRepository,
    private readonly compositionFactory: StandardBomCompositionFactory,
  ) {}

  async execute(
    command: RegisterStandardBomCommand,
  ): Promise<StandardBomReadModel> {
    assertCompositionInvariants(command.components);

    const existingStandardBom = await this.standardBomRepository.findByMiCode(
      command.miCode,
    );
    if (existingStandardBom) {
      throw StandardBomMiCodeAlreadyExists.withMiCode(command.miCode);
    }

    const componentLines = await this.compositionFactory.buildComponentLines(
      command.productId,
      command.components,
    );
    const standardBom = StandardBom.register(
      command.miCode,
      command.brand,
      command.standardLength,
      command.active,
      command.description,
      command.productId,
      componentLines,
    );
    await this.standardBomRepository.save(standardBom);

    return StandardBomReadModel.fromDomain(standardBom);
  }
}
