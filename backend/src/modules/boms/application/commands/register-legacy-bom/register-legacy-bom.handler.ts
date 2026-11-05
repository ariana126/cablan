import { assertCompositionInvariants } from '@boms/application/commands/assert-composition-invariants';
import { BomCompositionFactory } from '@boms/application/service/bom-composition.factory';
import { Bom } from '@boms/domain/bom.aggregate';
import { BomRepository } from '@boms/domain/service/bom.repository';
import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';

import { RegisterLegacyBomCommand } from './register-legacy-bom.command';

/**
 * `RegisterBomHandler` without the order rule: what registering was before
 * issue #101. Answers the new daily BOM's id. Provided only by
 * `BomsTestingModule` (test stack), not by `BomsModule`.
 */
@CommandHandler(RegisterLegacyBomCommand)
export class RegisterLegacyBomHandler implements ICommandHandler<
  RegisterLegacyBomCommand,
  string
> {
  constructor(
    private readonly bomRepository: BomRepository,
    private readonly compositionFactory: BomCompositionFactory,
  ) {}

  async execute(command: RegisterLegacyBomCommand): Promise<string> {
    assertCompositionInvariants(command.components);
    const composition = await this.compositionFactory.buildComposition(
      command.standardBomMiCode,
      command.components,
    );
    const bom = Bom.register(
      composition.standardBomId,
      composition.miCode,
      composition.brand,
      composition.productName,
      composition.standardLength,
      command.orderNumber,
      command.trackingNumber,
      command.description,
      command.registeredBy,
      composition.componentLines,
    );
    await this.bomRepository.save(bom);
    return bom.id.asString();
  }
}
