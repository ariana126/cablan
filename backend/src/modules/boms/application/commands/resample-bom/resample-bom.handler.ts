import { assertCompositionInvariants } from '@boms/application/commands/assert-composition-invariants';
import { BomCompositionFactory } from '@boms/application/service/bom-composition.factory';
import { BomRepository } from '@boms/domain/service/bom.repository';
import { Identity } from '@framework/domain';
import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';

import { ResampleBomCommand } from './resample-bom.command';

// Load the rejected daily BOM, ask the repository whether it is the latest of
// its tracking number, clone the composition from its MI code's standard BOM
// with the new weights, and let `Bom.resample()` decide and register the new
// one (refusing with `BomNotResamplable`). Only the new BOM is saved; the
// source is never written. Two concurrent re-samples of one BOM can both pass
// (no lock) — accepted in the design, since the duplicate is an ordinary,
// deletable daily BOM.
@CommandHandler(ResampleBomCommand)
export class ResampleBomHandler implements ICommandHandler<
  ResampleBomCommand,
  Identity
> {
  constructor(
    private readonly bomRepository: BomRepository,
    private readonly compositionFactory: BomCompositionFactory,
  ) {}

  async execute(command: ResampleBomCommand): Promise<Identity> {
    const source = await this.bomRepository.get(command.sourceBomId);
    const isLatestOfTrackingNumber =
      await this.bomRepository.isLatestOfItsTrackingNumber(source.id);
    assertCompositionInvariants(command.components);
    const {
      standardBomId,
      brand,
      productName,
      standardLength,
      componentLines,
    } = await this.compositionFactory.buildComposition(
      source.standardBomMiCode(),
      command.components,
    );

    const resampled = source.resample(
      isLatestOfTrackingNumber,
      standardBomId,
      brand,
      productName,
      standardLength,
      componentLines,
      command.description,
      command.registeredBy,
    );
    await this.bomRepository.save(resampled);

    return resampled.id;
  }
}
