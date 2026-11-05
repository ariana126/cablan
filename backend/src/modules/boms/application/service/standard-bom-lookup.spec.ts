import { OrderMiCodeNotFound } from '@boms/application/exceptions';
import { StubQueryBus } from '@boms/application/support/stub-query-bus';
import { EntityNotFound, Identity, toAsciiDigits } from '@framework/domain';
import { GetManufacturingInstructionByMiCodeQuery } from '@manufacturing-instructions/application/queries/get-manufacturing-instruction-by-mi-code/get-manufacturing-instruction-by-mi-code.query';
import { ManufacturingInstructionReadModel } from '@manufacturing-instructions/application/queries/list-manufacturing-instructions/manufacturing-instruction.read-model';
import { QueryBus } from '@nestjs/cqrs';

import { StandardBomLookup } from './standard-bom-lookup';

function standardBom(miCode: string): ManufacturingInstructionReadModel {
  return new ManufacturingInstructionReadModel(
    `standard-bom-${miCode}`,
    miCode,
    'Legrand',
    305,
    true,
    undefined,
    'product-cable-2.5',
    'کابل 2.5',
    [],
  );
}

function makeSut(...miCodes: string[]) {
  const queryBus = new StubQueryBus();
  queryBus.answerWith(
    GetManufacturingInstructionByMiCodeQuery.name,
    (query) => {
      const code = toAsciiDigits(
        (query as GetManufacturingInstructionByMiCodeQuery).miCode,
      );
      if (!miCodes.includes(code)) {
        throw EntityNotFound.withId(Identity.fromString(code));
      }
      return standardBom(code);
    },
  );
  return new StandardBomLookup(queryBus as unknown as QueryBus);
}

describe('StandardBomLookup', () => {
  it('resolves each MI code to the standard BOM it names, with its product, in the order given', async () => {
    const sut = makeSut('1001', '1002');

    const miCodes = await sut.assignable(['1002', '۱۰۰۱']);

    expect(
      miCodes.map((miCode) => [
        miCode.standardBomId().asString(),
        miCode.miCode(),
        miCode.productId().asString(),
        miCode.productName(),
      ]),
    ).toEqual([
      ['standard-bom-1002', '1002', 'product-cable-2.5', 'کابل 2.5'],
      ['standard-bom-1001', '1001', 'product-cable-2.5', 'کابل 2.5'],
    ]);
  });

  it('refuses an MI code no standard BOM has, naming it as typed', async () => {
    const sut = makeSut('1001');

    const refusal = sut.assignable(['1001', '9999']);

    await expect(refusal).rejects.toBeInstanceOf(OrderMiCodeNotFound);
    await expect(refusal).rejects.toMatchObject({ miCode: '9999' });
  });

  it('passes any other failure on', async () => {
    const queryBus = new StubQueryBus();
    queryBus.rejectWith(
      GetManufacturingInstructionByMiCodeQuery.name,
      new Error('connection lost'),
    );
    const sut = new StandardBomLookup(queryBus as unknown as QueryBus);

    await expect(sut.assignable(['1001'])).rejects.toThrow('connection lost');
  });
});
