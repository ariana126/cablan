import { Identity } from '@framework/domain';
import { InMemoryManufacturingInstructionRepository } from '@manufacturing-instructions/application/support/in-memory-manufacturing-instruction-repository';
import { ManufacturingInstruction } from '@manufacturing-instructions/domain/manufacturing-instruction.aggregate';
import { Brand } from '@manufacturing-instructions/domain/value/brand.vo';
import { ManufacturingInstructionComponentLine } from '@manufacturing-instructions/domain/value/manufacturing-instruction-component-line.vo';
import { ManufacturingInstructionMaterialLine } from '@manufacturing-instructions/domain/value/manufacturing-instruction-material-line.vo';
import { MiCode } from '@manufacturing-instructions/domain/value/mi-code.vo';
import { StandardLength } from '@manufacturing-instructions/domain/value/standard-length.vo';
import { Weight } from '@manufacturing-instructions/domain/value/weight.vo';

import { ListManufacturingInstructionsHandler } from './list-manufacturing-instructions.handler';

describe('ListManufacturingInstructionsHandler', () => {
  it('lists every registered standard BOM as a read model', async () => {
    const manufacturingInstructionRepository =
      new InMemoryManufacturingInstructionRepository();
    const sut = new ListManufacturingInstructionsHandler(
      manufacturingInstructionRepository,
    );
    manufacturingInstructionRepository.seed(
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

    const result = await sut.execute();

    expect(result).toEqual([
      expect.objectContaining({
        miCode: '1234',
        brand: 'Legrand',
        standardLength: 305,
        active: true,
        components: [
          expect.objectContaining({
            name: 'Bolt',
            materials: [
              expect.objectContaining({ name: 'Steel Rod', weight: 150 }),
            ],
          }),
        ],
      }),
    ]);
  });

  it('lists no standard BOMs when none are registered', async () => {
    const manufacturingInstructionRepository =
      new InMemoryManufacturingInstructionRepository();
    const sut = new ListManufacturingInstructionsHandler(
      manufacturingInstructionRepository,
    );

    const result = await sut.execute();

    expect(result).toEqual([]);
  });
});
