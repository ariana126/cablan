import { assertCompositionInvariants } from '@boms/application/commands/assert-composition-invariants';
import { BomCompositionFactory } from '@boms/application/service/bom-composition.factory';
import { BomRepository } from '@boms/domain/service/bom.repository';
import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';

import { EditBomCommand } from './edit-bom.command';

@CommandHandler(EditBomCommand)
export class EditBomHandler implements ICommandHandler<EditBomCommand> {
  constructor(
    private readonly bomRepository: BomRepository,
    private readonly compositionFactory: BomCompositionFactory,
  ) {}

  async execute(command: EditBomCommand): Promise<void> {
    const bom = await this.bomRepository.get(command.bomId);

    const orderNumber = command.orderNumber ?? bom.orderNumber();
    const trackingNumber = command.trackingNumber ?? bom.trackingNumber();
    const description =
      command.description === undefined
        ? bom.description()
        : command.description;

    bom.edit(orderNumber, trackingNumber, description);

    if (command.components !== undefined) {
      assertCompositionInvariants(command.components);
      // Known to be wrong purely from the command's own shape — a
      // programmer/DTO-boundary mistake, not a domain rule — so a plain
      // `Error` rather than an `ApplicationException`. The HTTP DTO's own
      // `@ValidateIf` guard is what actually prevents this in practice (see
      // `UpdateBomDto` and src/modules/boms/CLAUDE.md).
      if (command.standardBomMiCode === undefined) {
        throw new Error(
          'standardBomMiCode is required when components is provided',
        );
      }
      const { componentLines } = await this.compositionFactory.buildComposition(
        command.standardBomMiCode,
        command.components,
      );
      bom.updateComponents(componentLines);
    }

    await this.bomRepository.save(bom);
  }
}
