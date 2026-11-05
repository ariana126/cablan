import { assertCompositionInvariants } from '@boms/application/commands/assert-composition-invariants';
import {
  BomMustHaveAtLeastOneComponent,
  BomOrderNotDefined,
} from '@boms/application/exceptions';
import {
  BomComposition,
  BomCompositionFactory,
} from '@boms/application/service/bom-composition.factory';
import { Bom } from '@boms/domain/bom.aggregate';
import { Order } from '@boms/domain/order.aggregate';
import { BomRepository } from '@boms/domain/service/bom.repository';
import { OrderRepository } from '@boms/domain/service/order.repository';
import { BomEditContext } from '@boms/domain/value/bom-edit-context.vo';
import { BomEditor } from '@boms/domain/value/bom-editor.vo';
import { OrderNumber } from '@boms/domain/value/order-number.vo';
import {
  BomRepointing,
  StandardBomClone,
} from '@boms/domain/value/standard-bom-clone';
import { RecordDependencies } from '@framework/application';
import { Clock, toAsciiDigits } from '@framework/domain';
import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';

import { EditBomCommand } from './edit-bom.command';

@CommandHandler(EditBomCommand)
export class EditBomHandler implements ICommandHandler<EditBomCommand> {
  constructor(
    private readonly bomRepository: BomRepository,
    private readonly orderRepository: OrderRepository,
    private readonly compositionFactory: BomCompositionFactory,
    private readonly clock: Clock,
    private readonly recordDependencies: RecordDependencies,
  ) {}

  async execute(command: EditBomCommand): Promise<void> {
    // An unknown BOM is a 404, and a re-sampled one a 409, before anything
    // about the composition is looked up: a record another record
    // references can be neither edited nor deleted (issue #94).
    const stored = await this.bomRepository.get(command.bomId);
    await this.recordDependencies.assertNoDependents({
      type: 'Bom',
      id: stored.id.asString(),
    });

    let composition: BomComposition | undefined;
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
      composition = await this.compositionFactory.buildComposition(
        command.standardBomMiCode,
        command.components,
      );
    } else if (
      command.standardBomMiCode !== undefined &&
      toAsciiDigits(command.standardBomMiCode) !== stored.standardBomMiCode()
    ) {
      // Another MI code means another standard BOM's composition, which
      // only `components` can give.
      throw BomMustHaveAtLeastOneComponent.create();
    }

    const repointing = EditBomHandler.repointingOf(stored, composition);
    await this.assertOrderPermits(
      stored,
      command.orderNumber,
      repointing?.standardBom ?? null,
    );

    // The edit itself runs against the BOM as `modify()` loads it, after any
    // concurrent review or edit has committed — so the fields left unchanged
    // are resolved from that state, not from the read above.
    await this.bomRepository.modify(command.bomId, (bom) => {
      const orderNumber = command.orderNumber ?? bom.orderNumber();
      const trackingNumber = command.trackingNumber ?? bom.trackingNumber();
      const description =
        command.description === undefined
          ? bom.description()
          : command.description;
      const context = BomEditContext.of(
        command.editedBy,
        BomEditor.withRole(command.editorRole),
        command.editSource,
        command.editReason,
        this.clock.now(),
      );
      if (repointing === null) {
        bom.edit(
          orderNumber,
          trackingNumber,
          description,
          composition?.componentLines,
          context,
        );
      } else {
        bom.editRepointed(
          orderNumber,
          trackingNumber,
          description,
          repointing,
          context,
        );
      }
    });
  }

  /**
   * The standard BOM the edit re-points the daily BOM at (issue #101), with
   * the composition cloned from it, or null when it keeps its own. The composition's MI code only locates what
   * to clone from, so the same standard BOM under a renamed code, or another
   * standard BOM found under the stored code (one the digit normalisation
   * left behind), is not a change of MI code: only another code naming
   * another standard BOM is.
   */
  private static repointingOf(
    stored: Bom,
    composition: BomComposition | undefined,
  ): BomRepointing | null {
    if (
      composition === undefined ||
      composition.standardBomId.equals(stored.standardBomId()) ||
      composition.miCode === stored.standardBomMiCode()
    ) {
      return null;
    }
    return {
      standardBom: {
        standardBomId: composition.standardBomId,
        miCode: composition.miCode,
        brand: composition.brand,
        productName: composition.productName,
        standardLength: composition.standardLength,
      },
      components: composition.componentLines,
    };
  }

  /**
   * A daily BOM moved to another order, or to another MI code, must end up
   * on a defined order that allows it — the `Order`'s rules. Left alone,
   * neither is checked: a legacy daily BOM keeps whatever it had.
   */
  private async assertOrderPermits(
    stored: Bom,
    newOrderNumber: OrderNumber | undefined,
    repointedTo: StandardBomClone | null,
  ): Promise<void> {
    const orderNumber = newOrderNumber ?? stored.orderNumber();
    if (orderNumber.equals(stored.orderNumber()) && repointedTo === null) {
      return;
    }
    const order: Order | null =
      await this.orderRepository.findByOrderNumber(orderNumber);
    if (order === null) {
      throw BomOrderNotDefined.withOrderNumber(orderNumber);
    }
    if (repointedTo === null) {
      order.assertHoldsStandardBom(
        stored.standardBomId(),
        stored.standardBomMiCode(),
      );
    } else {
      order.assertPermitsRepointing(
        stored.standardBomId(),
        repointedTo.standardBomId,
        repointedTo.miCode,
      );
    }
  }
}
