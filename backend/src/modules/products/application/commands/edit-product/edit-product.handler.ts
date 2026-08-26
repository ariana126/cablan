import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { ProductCompositionFactory } from '@products/application/service/product-composition.factory';
import { ProductRepository } from '@products/domain/service/product.repository';

import { assertCompositionInvariants } from '../assert-composition-invariants';
import { EditProductCommand } from './edit-product.command';

@CommandHandler(EditProductCommand)
export class EditProductHandler implements ICommandHandler<EditProductCommand> {
  constructor(
    private readonly productRepository: ProductRepository,
    private readonly compositionFactory: ProductCompositionFactory,
  ) {}

  async execute(command: EditProductCommand): Promise<void> {
    const product = await this.productRepository.get(command.productId);

    if (command.name !== undefined) {
      product.rename(command.name);
    }

    if (command.components !== undefined) {
      assertCompositionInvariants(command.components);
      const componentLines =
        await this.compositionFactory.reconcileComponentLines(
          product.components(),
          command.components,
        );
      product.updateComponents(componentLines);
    }

    await this.productRepository.save(product);
  }
}
