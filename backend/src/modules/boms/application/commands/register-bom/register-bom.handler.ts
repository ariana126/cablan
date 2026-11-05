import { assertCompositionInvariants } from '@boms/application/commands/assert-composition-invariants';
import { BomOrderNotDefined } from '@boms/application/exceptions';
import { BomReadModel } from '@boms/application/queries/list-boms/bom.read-model';
import { BomCompositionFactory } from '@boms/application/service/bom-composition.factory';
import { Bom } from '@boms/domain/bom.aggregate';
import { BomRepository } from '@boms/domain/service/bom.repository';
import { OrderRepository } from '@boms/domain/service/order.repository';
import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';

import { RegisterBomCommand } from './register-bom.command';

/**
 * Registers a daily BOM — only for a defined order, with one of that order's
 * MI codes (issue #101): no MI code chosen takes the order's only one, and
 * must be chosen among several. The composition is cloned from that MI
 * code's standard BOM.
 */
@CommandHandler(RegisterBomCommand)
export class RegisterBomHandler implements ICommandHandler<
  RegisterBomCommand,
  BomReadModel
> {
  constructor(
    private readonly bomRepository: BomRepository,
    private readonly orderRepository: OrderRepository,
    private readonly compositionFactory: BomCompositionFactory,
  ) {}

  async execute(command: RegisterBomCommand): Promise<BomReadModel> {
    assertCompositionInvariants(command.components);

    const order = await this.orderRepository.findByOrderNumber(
      command.orderNumber,
    );
    if (order === null) {
      throw BomOrderNotDefined.withOrderNumber(command.orderNumber);
    }
    const miCode = order.miCodeForDailyBom(command.standardBomMiCode);

    const {
      standardBomId,
      brand,
      productName,
      standardLength,
      componentLines,
    } = await this.compositionFactory.buildComposition(
      miCode.miCode(),
      command.components,
    );

    const bom = Bom.register(
      standardBomId,
      miCode.miCode(),
      brand,
      productName,
      standardLength,
      command.orderNumber,
      command.trackingNumber,
      command.description,
      command.registeredBy,
      componentLines,
    );
    await this.bomRepository.save(bom);

    return BomReadModel.fromDomain(bom);
  }
}
