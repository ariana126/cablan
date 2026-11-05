import { EntityNotFound, Identity, toAsciiDigits } from '@framework/domain';

import { StubQueryBus } from './stub-query-bus';

/** A standard BOM as `manufacturing-instructions` answers for its MI code. */
export interface StubStandardBom {
  readonly id: string;
  readonly miCode: string;
  readonly productId: string;
  readonly productName: string;
  readonly brand?: string;
  readonly standardLength?: number;
  readonly components?: readonly {
    readonly id: string;
    readonly name: string;
    readonly materials: readonly {
      readonly id: string;
      readonly name: string;
      readonly weight: number;
    }[];
  }[];
}

// The query `BomCompositionFactory` and `StandardBomLookup` dispatch, by name:
// this support file may not import `manufacturing-instructions`.
const BY_MI_CODE_QUERY = 'GetManufacturingInstructionByMiCodeQuery';

/**
 * Answers every by-MI-code query on `queryBus` from `standardBoms`, the code
 * read with English digits as the real query does — an unknown code is its
 * `EntityNotFound`. The answer has the shape of
 * `ManufacturingInstructionReadModel`.
 */
export function stubStandardBoms(
  queryBus: StubQueryBus,
  standardBoms: readonly StubStandardBom[],
): void {
  queryBus.answerWith(BY_MI_CODE_QUERY, (query) => {
    const miCode = toAsciiDigits((query as { miCode: string }).miCode);
    const found = standardBoms.find(
      (standardBom) => standardBom.miCode === miCode,
    );
    if (found === undefined) {
      throw EntityNotFound.withId(Identity.fromString(miCode));
    }
    return {
      brand: 'Legrand',
      standardLength: 305,
      active: true,
      description: undefined,
      components: [],
      ...found,
    };
  });
}
