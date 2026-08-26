import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { ProductReadModel } from '@products/application/queries/list-products/product.read-model';
import { ProductCompositionFactory } from '@products/application/service/product-composition.factory';
import { Product } from '@products/domain/product.aggregate';
import { ProductRepository } from '@products/domain/service/product.repository';

import { assertCompositionInvariants } from '../assert-composition-invariants';
import { RegisterProductCommand } from './register-product.command';

@CommandHandler(RegisterProductCommand)
export class RegisterProductHandler implements ICommandHandler<
  RegisterProductCommand,
  ProductReadModel
> {
  constructor(
    private readonly productRepository: ProductRepository,
    private readonly compositionFactory: ProductCompositionFactory,
  ) {}

  async execute(command: RegisterProductCommand): Promise<ProductReadModel> {
    assertCompositionInvariants(command.components);

    const componentLines = await this.compositionFactory.createComponentLines(
      command.components,
    );
    const product = Product.register(command.name, componentLines);
    await this.productRepository.save(product);

    return ProductReadModel.fromDomain(product);
  }
}
