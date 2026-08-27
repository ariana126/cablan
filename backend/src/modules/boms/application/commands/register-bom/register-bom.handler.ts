import { assertCompositionInvariants } from '@boms/application/commands/assert-composition-invariants';
import { BomReadModel } from '@boms/application/queries/list-boms/bom.read-model';
import { BomCompositionFactory } from '@boms/application/service/bom-composition.factory';
import { Bom } from '@boms/domain/bom.aggregate';
import { BomRepository } from '@boms/domain/service/bom.repository';
import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';

import { RegisterBomCommand } from './register-bom.command';

@CommandHandler(RegisterBomCommand)
export class RegisterBomHandler implements ICommandHandler<
  RegisterBomCommand,
  BomReadModel
> {
  constructor(
    private readonly bomRepository: BomRepository,
    private readonly compositionFactory: BomCompositionFactory,
  ) {}

  async execute(command: RegisterBomCommand): Promise<BomReadModel> {
    assertCompositionInvariants(command.components);

    const { standardBomId, componentLines } =
      await this.compositionFactory.buildComposition(
        command.standardBomMiCode,
        command.components,
      );

    const bom = Bom.register(
      standardBomId,
      command.orderNumber,
      command.trackingNumber,
      command.description,
      componentLines,
    );
    await this.bomRepository.save(bom);

    return BomReadModel.fromDomain(bom);
  }
}
