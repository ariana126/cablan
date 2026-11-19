import {
  ApplyToRelatedRecords,
  RecordDependencies,
  UnitOfWork,
} from '@framework/application';
import { ManufacturingInstructionMiCodeAlreadyExists } from '@manufacturing-instructions/application/exceptions';
import { ManufacturingInstructionCompositionFactory } from '@manufacturing-instructions/application/service/manufacturing-instruction-composition.factory';
import { ManufacturingInstruction } from '@manufacturing-instructions/domain/manufacturing-instruction.aggregate';
import { ManufacturingInstructionRepository } from '@manufacturing-instructions/domain/service/manufacturing-instruction.repository';
import { ManufacturingInstructionComponentLine } from '@manufacturing-instructions/domain/value/manufacturing-instruction-component-line.vo';
import { MiCode } from '@manufacturing-instructions/domain/value/mi-code.vo';
import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';

import { assertCompositionInvariants } from '../assert-composition-invariants';
import { EditManufacturingInstructionCommand } from './edit-manufacturing-instruction.command';

@CommandHandler(EditManufacturingInstructionCommand)
export class EditManufacturingInstructionHandler implements ICommandHandler<EditManufacturingInstructionCommand> {
  constructor(
    private readonly manufacturingInstructionRepository: ManufacturingInstructionRepository,
    private readonly compositionFactory: ManufacturingInstructionCompositionFactory,
    private readonly recordDependencies: RecordDependencies,
    private readonly unitOfWork: UnitOfWork,
  ) {}

  async execute(command: EditManufacturingInstructionCommand): Promise<void> {
    await this.unitOfWork.run(async () => {
      const manufacturingInstruction =
        await this.manufacturingInstructionRepository.get(
          command.manufacturingInstructionId,
        );

      const miCode = command.miCode ?? manufacturingInstruction.miCode();
      const brand = command.brand ?? manufacturingInstruction.brand();
      const standardLength =
        command.standardLength ?? manufacturingInstruction.standardLength();
      const description =
        command.description === undefined
          ? manufacturingInstruction.description()
          : command.description;
      const active = command.active ?? manufacturingInstruction.active();

      // A record another record references can be neither edited nor
      // deleted (issue #94) — checked before anything changes — unless it is
      // the System Admin's correction (issue #126): weights, brand, standard
      // length, description and active flag, never the MI code or which
      // materials each component holds. It needs no confirmation, so the
      // System Admin is always taken to have asked for it; the corrected
      // brand and standard length are carried into the daily BOMs' snapshots.
      await this.recordDependencies.editRecordInUse(
        { type: 'StandardBom', id: manufacturingInstruction.id.asString() },
        {
          applyToRelatedRecords: ApplyToRelatedRecords.askedBy(
            command.editorRole,
            true,
          ),
          changesOnlyCorrectableFields:
            manufacturingInstruction.changesOnlyCorrectableFields(
              miCode,
              command.components?.flatMap((component) =>
                component.materials.map((material) => ({
                  componentId: component.componentId,
                  materialId: material.materialId,
                })),
              ),
            ),
          before: {
            name: manufacturingInstruction.miCode().asString(),
            brand: manufacturingInstruction.brand().asString(),
            standardLength: manufacturingInstruction
              .standardLength()
              .asNumber(),
          },
          after: {
            name: miCode.asString(),
            brand: brand.asString(),
            standardLength: standardLength.asNumber(),
          },
        },
        async () => {
          await this.assertMiCodeFree(manufacturingInstruction, miCode);

          let componentLines:
            | ManufacturingInstructionComponentLine[]
            | undefined;
          if (command.components !== undefined) {
            assertCompositionInvariants(command.components);
            ({ componentLines } =
              await this.compositionFactory.buildComponentLines(
                manufacturingInstruction.productId(),
                command.components,
              ));
          }

          manufacturingInstruction.edit(
            miCode,
            brand,
            standardLength,
            description,
            active,
            componentLines,
          );

          await this.manufacturingInstructionRepository.save(
            manufacturingInstruction,
          );
        },
      );
    });
  }

  private async assertMiCodeFree(
    manufacturingInstruction: ManufacturingInstruction,
    miCode: MiCode,
  ): Promise<void> {
    const conflictingManufacturingInstruction =
      await this.manufacturingInstructionRepository.findByMiCode(miCode);
    if (
      conflictingManufacturingInstruction &&
      !conflictingManufacturingInstruction.id.equals(
        manufacturingInstruction.id,
      )
    ) {
      throw ManufacturingInstructionMiCodeAlreadyExists.withMiCode(miCode);
    }
  }
}
