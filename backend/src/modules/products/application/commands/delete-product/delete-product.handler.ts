import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { ProductRepository } from '@products/domain/service/product.repository';

import { DeleteProductCommand } from './delete-product.command';

@CommandHandler(DeleteProductCommand)
export class DeleteProductHandler implements ICommandHandler<DeleteProductCommand> {
  constructor(private readonly productRepository: ProductRepository) {}

  async execute(command: DeleteProductCommand): Promise<void> {
    const product = await this.productRepository.get(command.productId);
    product.delete();
    // Hard delete: nothing yet references a product, so the row is removed
    // outright rather than upserted behind a flag.
    await this.productRepository.delete(product);
  }
}
