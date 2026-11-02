import { RecordDependencies } from '@framework/application';
import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { ProductRepository } from '@products/domain/service/product.repository';

import { DeleteProductCommand } from './delete-product.command';

@CommandHandler(DeleteProductCommand)
export class DeleteProductHandler implements ICommandHandler<DeleteProductCommand> {
  constructor(
    private readonly productRepository: ProductRepository,
    private readonly recordDependencies: RecordDependencies,
  ) {}

  async execute(command: DeleteProductCommand): Promise<void> {
    const product = await this.productRepository.get(command.productId);
    // A record another record references can be neither edited nor
    // deleted (issue #94) — checked before anything changes.
    await this.recordDependencies.assertNoDependents({
      type: 'Product',
      id: product.id.asString(),
    });
    product.delete();
    // Hard delete: nothing references the product any more, so the row is
    // removed outright (its own composition rows with it) rather than
    // upserted behind a flag. No material or component is deleted with it.
    await this.productRepository.delete(product);
  }
}
