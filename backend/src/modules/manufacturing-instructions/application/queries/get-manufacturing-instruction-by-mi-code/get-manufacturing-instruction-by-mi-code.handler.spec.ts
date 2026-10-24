import { EntityNotFound, Identity } from '@framework/domain';
import { InMemoryManufacturingInstructionRepository } from '@manufacturing-instructions/application/support/in-memory-manufacturing-instruction-repository';
import { ManufacturingInstruction } from '@manufacturing-instructions/domain/manufacturing-instruction.aggregate';
import { Brand } from '@manufacturing-instructions/domain/value/brand.vo';
import { ManufacturingInstructionComponentLine } from '@manufacturing-instructions/domain/value/manufacturing-instruction-component-line.vo';
import { ManufacturingInstructionMaterialLine } from '@manufacturing-instructions/domain/value/manufacturing-instruction-material-line.vo';
import { MiCode } from '@manufacturing-instructions/domain/value/mi-code.vo';
import { StandardLength } from '@manufacturing-instructions/domain/value/standard-length.vo';
import { Weight } from '@manufacturing-instructions/domain/value/weight.vo';

import { GetManufacturingInstructionByMiCodeHandler } from './get-manufacturing-instruction-by-mi-code.handler';
import { GetManufacturingInstructionByMiCodeQuery } from './get-manufacturing-instruction-by-mi-code.query';

describe('GetManufacturingInstructionByMiCodeHandler', () => {
  it('gets a registered standard BOM by its MI code as a read model', async () => {
    const manufacturingInstructionRepository =
      new InMemoryManufacturingInstructionRepository();
    const sut = new GetManufacturingInstructionByMiCodeHandler(
      manufacturingInstructionRepository,
    );
    const manufacturingInstruction = manufacturingInstructionRepository.seed(
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

    const result = await sut.execute(
      new GetManufacturingInstructionByMiCodeQuery('1234'),
    );

    expect(result).toEqual(
      expect.objectContaining({
        id: manufacturingInstruction.id.asString(),
        miCode: '1234',
        components: [
          expect.objectContaining({
            name: 'Bolt',
            materials: [expect.objectContaining({ name: 'Steel Rod' })],
          }),
        ],
      }),
    );
  });

  it('an MI code typed with Persian digits finds the standard BOM registered with English digits', async () => {
    const manufacturingInstructionRepository =
      new InMemoryManufacturingInstructionRepository();
    const sut = new GetManufacturingInstructionByMiCodeHandler(
      manufacturingInstructionRepository,
    );
    const manufacturingInstruction = manufacturingInstructionRepository.seed(
      ManufacturingInstruction.register(
        MiCode.fromString('0001'),
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

    const result = await sut.execute(
      new GetManufacturingInstructionByMiCodeQuery('۰۰۰۱'),
    );

    expect(result.id).toBe(manufacturingInstruction.id.asString());
  });

  it('rejects getting a standard BOM whose MI code does not resolve to an existing one', async () => {
    const manufacturingInstructionRepository =
      new InMemoryManufacturingInstructionRepository();
    const sut = new GetManufacturingInstructionByMiCodeHandler(
      manufacturingInstructionRepository,
    );

    await expect(
      sut.execute(
        new GetManufacturingInstructionByMiCodeQuery('unknown-mi-code'),
      ),
    ).rejects.toBeInstanceOf(EntityNotFound);
  });
});
