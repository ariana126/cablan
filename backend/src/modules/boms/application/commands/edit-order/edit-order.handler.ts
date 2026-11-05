import { OrderNumberTaken } from '@boms/application/exceptions';
import { StandardBomLookup } from '@boms/application/service/standard-bom-lookup';
import { OrderRepository } from '@boms/domain/service/order.repository';
import { RecordDependencies, UnitOfWork } from '@framework/application';
import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';

import { EditOrderCommand } from './edit-order.command';

/**
 * Edits an order: its number, and its MI codes replaced wholesale. An order
 * its daily BOMs reference can be neither (issue #94) — unless it is the
 * System Admin's correction of its number alone, confirmed with
 * `applyToRelatedRecords` (issue #110), which every daily BOM holding the old
 * number follows. The MI codes are resolved first, so the order compares the
 * standard BOMs themselves, in one place (`Order.changesOnlyCorrectableFields`
 * and `Order.edit`): resending its codes in another order changes nothing,
 * while any other change of them on an order in use is never a correction.
 * One unit of work, under the order's lock (`modify()`): the save, the daily
 * BOMs' rewrite and the audit entry commit or roll back together.
 */
@CommandHandler(EditOrderCommand)
export class EditOrderHandler implements ICommandHandler<EditOrderCommand> {
  constructor(
    private readonly orderRepository: OrderRepository,
    private readonly standardBomLookup: StandardBomLookup,
    private readonly recordDependencies: RecordDependencies,
    private readonly unitOfWork: UnitOfWork,
  ) {}

  async execute(command: EditOrderCommand): Promise<void> {
    // An unknown order is the 404 before its MI codes are looked up.
    await this.orderRepository.get(command.orderId);
    const miCodes =
      command.miCodes === undefined
        ? undefined
        : await this.standardBomLookup.assignable(command.miCodes);

    await this.unitOfWork.run(() =>
      this.orderRepository.modify(command.orderId, async (order) => {
        const orderNumber = command.orderNumber ?? order.orderNumber();
        await this.recordDependencies.editRecordInUse(
          { type: 'order', id: order.id.asString() },
          {
            applyToRelatedRecords: command.applyToRelatedRecords,
            changesOnlyCorrectableFields:
              order.changesOnlyCorrectableFields(miCodes),
            before: { name: order.orderNumber().asString() },
            after: { name: orderNumber.asString() },
          },
          async () => {
            const holder =
              await this.orderRepository.findByOrderNumber(orderNumber);
            if (holder && !holder.id.equals(order.id)) {
              throw OrderNumberTaken.withOrderNumber(orderNumber);
            }
            // Saved by `modify()` once this returns.
            order.edit(orderNumber, miCodes ?? order.miCodes());
          },
        );
      }),
    );
  }
}
