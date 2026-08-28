import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { StandardBomMiCodeAlreadyExists } from '@standard-boms/application/exceptions';
import { StandardBomCompositionFactory } from '@standard-boms/application/service/standard-bom-composition.factory';
import { StandardBomRepository } from '@standard-boms/domain/service/standard-bom.repository';

import { assertCompositionInvariants } from '../assert-composition-invariants';
import { EditStandardBomCommand } from './edit-standard-bom.command';

@CommandHandler(EditStandardBomCommand)
export class EditStandardBomHandler implements ICommandHandler<EditStandardBomCommand> {
  constructor(
    private readonly standardBomRepository: StandardBomRepository,
    private readonly compositionFactory: StandardBomCompositionFactory,
  ) {}

  async execute(command: EditStandardBomCommand): Promise<void> {
    const standardBom = await this.standardBomRepository.get(
      command.standardBomId,
    );

    const miCode = command.miCode ?? standardBom.miCode();
    const brand = command.brand ?? standardBom.brand();
    const standardLength =
      command.standardLength ?? standardBom.standardLength();
    const description =
      command.description === undefined
        ? standardBom.description()
        : command.description;
    const active = command.active ?? standardBom.active();

    const conflictingStandardBom =
      await this.standardBomRepository.findByMiCode(miCode);
    if (
      conflictingStandardBom &&
      !conflictingStandardBom.id.equals(standardBom.id)
    ) {
      throw StandardBomMiCodeAlreadyExists.withMiCode(miCode);
    }

    standardBom.edit(miCode, brand, standardLength, description, active);

    if (command.components !== undefined) {
      assertCompositionInvariants(command.components);
      const { componentLines } =
        await this.compositionFactory.buildComponentLines(
          standardBom.productId(),
          command.components,
        );
      standardBom.updateComponents(componentLines);
    }

    await this.standardBomRepository.save(standardBom);
  }
}
