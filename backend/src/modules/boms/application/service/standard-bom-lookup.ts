import { OrderMiCodeNotFound } from '@boms/application/exceptions';
import { OrderMiCode } from '@boms/domain/value/order-mi-code.vo';
import { EntityNotFound, Identity } from '@framework/domain';
import { GetManufacturingInstructionByMiCodeQuery } from '@manufacturing-instructions/application/queries/get-manufacturing-instruction-by-mi-code/get-manufacturing-instruction-by-mi-code.query';
import { ManufacturingInstructionReadModel } from '@manufacturing-instructions/application/queries/list-manufacturing-instructions/manufacturing-instruction.read-model';
import { Injectable } from '@nestjs/common';
import { QueryBus } from '@nestjs/cqrs';

/**
 * Resolves the MI codes an order is given (issue #101) to the standard BOMs
 * they name, as the order keeps them: the standard BOM's id and a snapshot of
 * its MI code and its product's id and name (`OrderMiCode`).
 *
 * Reads through `GetManufacturingInstructionByMiCodeQuery` on the `QueryBus`
 * — the same query `BomCompositionFactory` dispatches, never
 * `manufacturing-instructions`' repository — and is the one file the
 * `standard-bom-lookup-reuse-is-narrow` carve-out lets import it (with its
 * read model). Kept apart from the factory, which clones a composition; this
 * only names a standard BOM.
 */
@Injectable()
export class StandardBomLookup {
  constructor(private readonly queryBus: QueryBus) {}

  /**
   * Every MI code's standard BOM, in the order given (the codes as typed:
   * Persian digits are read as English ones by the query). One that names no
   * standard BOM is refused as `OrderMiCodeNotFound`, naming it as typed.
   */
  async assignable(miCodes: readonly string[]): Promise<OrderMiCode[]> {
    const resolved: OrderMiCode[] = [];
    for (const miCode of miCodes) {
      const standardBom = await this.fetch(miCode);
      resolved.push(
        OrderMiCode.of(
          Identity.fromString(standardBom.id),
          standardBom.miCode,
          Identity.fromString(standardBom.productId),
          standardBom.productName,
        ),
      );
    }
    return resolved;
  }

  private async fetch(
    miCode: string,
  ): Promise<ManufacturingInstructionReadModel> {
    try {
      return await this.queryBus.execute<
        GetManufacturingInstructionByMiCodeQuery,
        ManufacturingInstructionReadModel
      >(new GetManufacturingInstructionByMiCodeQuery(miCode));
    } catch (error) {
      if (error instanceof EntityNotFound) {
        throw OrderMiCodeNotFound.withMiCode(miCode);
      }
      throw error;
    }
  }
}
