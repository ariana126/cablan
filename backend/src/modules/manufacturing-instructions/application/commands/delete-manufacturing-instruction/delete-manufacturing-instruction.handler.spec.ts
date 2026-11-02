import {
  RecordDependencies,
  RecordHasDependents,
} from '@framework/application';
import { StubDependentsProbe } from '@framework/application/support/stub-dependents-probe';
import { EntityNotFound, Identity } from '@framework/domain';
import { InMemoryManufacturingInstructionRepository } from '@manufacturing-instructions/application/support/in-memory-manufacturing-instruction-repository';
import { ManufacturingInstruction } from '@manufacturing-instructions/domain/manufacturing-instruction.aggregate';
import { Brand } from '@manufacturing-instructions/domain/value/brand.vo';
import { ManufacturingInstructionComponentLine } from '@manufacturing-instructions/domain/value/manufacturing-instruction-component-line.vo';
import { ManufacturingInstructionMaterialLine } from '@manufacturing-instructions/domain/value/manufacturing-instruction-material-line.vo';
import { MiCode } from '@manufacturing-instructions/domain/value/mi-code.vo';
import { StandardLength } from '@manufacturing-instructions/domain/value/standard-length.vo';
import { Weight } from '@manufacturing-instructions/domain/value/weight.vo';

import { DeleteManufacturingInstructionCommand } from './delete-manufacturing-instruction.command';
import { DeleteManufacturingInstructionHandler } from './delete-manufacturing-instruction.handler';

function seedStandardBom(
  manufacturingInstructionRepository: InMemoryManufacturingInstructionRepository,
): ManufacturingInstruction {
  return manufacturingInstructionRepository.seed(
    ManufacturingInstruction.register(
      MiCode.fromString('1234'),
      Brand.fromString('Legrand'),
      StandardLength.of(305),
      true,
      undefined,
      Identity.new(),
      'Product 1',
      [
        ManufacturingInstructionComponentLine.of(Identity.new(), 'Bolt', [
          ManufacturingInstructionMaterialLine.of(
            Identity.new(),
            'Steel Rod',
            Weight.ofGrams(150),
          ),
        ]),
      ],
    ),
  );
}

describe('DeleteManufacturingInstructionHandler', () => {
  it('hard-deletes a standard BOM', async () => {
    const manufacturingInstructionRepository =
      new InMemoryManufacturingInstructionRepository();
    const sut = new DeleteManufacturingInstructionHandler(
      manufacturingInstructionRepository,
      new RecordDependencies([]),
    );
    const manufacturingInstruction = seedStandardBom(
      manufacturingInstructionRepository,
    );

    await sut.execute(
      new DeleteManufacturingInstructionCommand(manufacturingInstruction.id),
    );

    await expect(
      manufacturingInstructionRepository.get(manufacturingInstruction.id),
    ).rejects.toBeInstanceOf(EntityNotFound);
  });

  it('refuses deleting a standard BOM a daily BOM references, keeping it', async () => {
    const manufacturingInstructionRepository =
      new InMemoryManufacturingInstructionRepository();
    const manufacturingInstruction = seedStandardBom(
      manufacturingInstructionRepository,
    );
    const probe = new StubDependentsProbe().given(
      { type: 'StandardBom', id: manufacturingInstruction.id.asString() },
      [{ kind: 'daily-bom', name: 'ORD-1' }],
    );
    const sut = new DeleteManufacturingInstructionHandler(
      manufacturingInstructionRepository,
      new RecordDependencies([probe]),
    );

    await expect(
      sut.execute(
        new DeleteManufacturingInstructionCommand(manufacturingInstruction.id),
      ),
    ).rejects.toBeInstanceOf(RecordHasDependents);
    expect(
      await manufacturingInstructionRepository.find(
        manufacturingInstruction.id,
      ),
    ).not.toBeNull();
  });

  it('rejects deleting a standard BOM that does not exist', async () => {
    const manufacturingInstructionRepository =
      new InMemoryManufacturingInstructionRepository();
    const sut = new DeleteManufacturingInstructionHandler(
      manufacturingInstructionRepository,
      new RecordDependencies([]),
    );

    await expect(
      sut.execute(new DeleteManufacturingInstructionCommand(Identity.new())),
    ).rejects.toBeInstanceOf(EntityNotFound);
  });
});
