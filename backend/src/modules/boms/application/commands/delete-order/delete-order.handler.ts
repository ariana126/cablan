import { BomRepository } from '@boms/domain/service/bom.repository';
import { OrderRepository } from '@boms/domain/service/order.repository';
import { RecordDependencies, UnitOfWork } from '@framework/application';
import { Role } from '@framework/domain';
import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';

import { DeleteOrderCommand } from './delete-order.command';

/**
 * Deletes an order. One its daily BOMs reference cannot be deleted (issue
 * #94) — except by the System Admin (the System Admin exception approved for
 * issue #101), whose delete takes every daily BOM of the order with it,
 * re-samples included, each recording its own `BomDeleted`. One unit of
 * work, under the order's lock (`modify()`): the order, its daily BOMs and
 * their audit entries go together or not at all.
 */
@CommandHandler(DeleteOrderCommand)
export class DeleteOrderHandler implements ICommandHandler<DeleteOrderCommand> {
  constructor(
    private readonly orderRepository: OrderRepository,
    private readonly bomRepository: BomRepository,
    private readonly recordDependencies: RecordDependencies,
    private readonly unitOfWork: UnitOfWork,
  ) {}

  async execute(command: DeleteOrderCommand): Promise<void> {
    await this.unitOfWork.run(() =>
      this.orderRepository.modify(command.orderId, async (order) => {
        if (command.deleterRole === Role.SystemAdmin) {
          // Directly, not through `DeleteBomHandler`: a re-sampled daily BOM
          // goes too, with the re-sample that locks it.
          for (const bom of await this.bomRepository.listByOrderNumber(
            order.orderNumber(),
          )) {
            bom.delete();
            await this.bomRepository.delete(bom);
          }
        } else {
          await this.recordDependencies.assertNoDependents({
            type: 'order',
            id: order.id.asString(),
          });
        }
        // Deleted by `modify()` once this returns.
        order.delete();
      }),
    );
  }
}
