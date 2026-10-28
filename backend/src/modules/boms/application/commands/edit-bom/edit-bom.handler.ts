import { assertCompositionInvariants } from '@boms/application/commands/assert-composition-invariants';
import { BomCompositionFactory } from '@boms/application/service/bom-composition.factory';
import { BomRepository } from '@boms/domain/service/bom.repository';
import { BomComponentLine } from '@boms/domain/value/bom-component-line.vo';
import { BomEditContext } from '@boms/domain/value/bom-edit-context.vo';
import { BomEditor } from '@boms/domain/value/bom-editor.vo';
import { Clock } from '@framework/domain';
import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';

import { EditBomCommand } from './edit-bom.command';

@CommandHandler(EditBomCommand)
export class EditBomHandler implements ICommandHandler<EditBomCommand> {
  constructor(
    private readonly bomRepository: BomRepository,
    private readonly compositionFactory: BomCompositionFactory,
    private readonly clock: Clock,
  ) {}

  async execute(command: EditBomCommand): Promise<void> {
    // An unknown BOM is a 404 before anything about the composition is
    // looked up.
    await this.bomRepository.get(command.bomId);

    let componentLines: BomComponentLine[] | undefined;
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
      ({ componentLines } = await this.compositionFactory.buildComposition(
        command.standardBomMiCode,
        command.components,
      ));
    }

    // The edit itself runs against the BOM as `modify()` loads it, after any
    // concurrent review or edit has committed — so the fields left unchanged
    // are resolved from that state, not from the read above.
    await this.bomRepository.modify(command.bomId, (bom) =>
      bom.edit(
        command.orderNumber ?? bom.orderNumber(),
        command.trackingNumber ?? bom.trackingNumber(),
        command.description === undefined
          ? bom.description()
          : command.description,
        componentLines,
        BomEditContext.of(
          command.editedBy,
          BomEditor.withRole(command.editorRole),
          command.editSource,
          command.editReason,
          this.clock.now(),
        ),
      ),
    );
  }
}
