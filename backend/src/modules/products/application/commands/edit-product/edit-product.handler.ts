import { RecordDependencies, UnitOfWork } from '@framework/application';
import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { ProductCompositionFactory } from '@products/application/service/product-composition.factory';
import { Product } from '@products/domain/product.aggregate';
import { ProductRepository } from '@products/domain/service/product.repository';
import { ProductComponentLine } from '@products/domain/value/product-component-line.vo';

import { assertCompositionInvariants } from '../assert-composition-invariants';
import { EditProductCommand } from './edit-product.command';

@CommandHandler(EditProductCommand)
export class EditProductHandler implements ICommandHandler<EditProductCommand> {
  constructor(
    private readonly productRepository: ProductRepository,
    private readonly compositionFactory: ProductCompositionFactory,
    private readonly recordDependencies: RecordDependencies,
    private readonly unitOfWork: UnitOfWork,
  ) {}

  async execute(command: EditProductCommand): Promise<void> {
    await this.unitOfWork.run(async () => {
      const product = await this.productRepository.get(command.productId);
      // Whether a correction leaves the composition alone can only be told
      // once the request's composition is resolved, so a granted correction
      // resolves it first; any other edit is refused before resolving
      // anything, as before.
      let componentLines: ProductComponentLine[] | undefined;
      if (
        command.applyToRelatedRecords.isGranted() &&
        command.components !== undefined
      ) {
        componentLines = await this.componentLinesOf(command, product);
      }
      const changesOnlyName =
        command.components === undefined ||
        (componentLines !== undefined &&
          product.changesOnlyCorrectableFields(componentLines));

      // A record another record references can be neither edited nor
      // deleted (issue #94) — unless it is the System Admin's correction of
      // its name alone (issue #110), carried into its standard and daily
      // BOMs.
      await this.recordDependencies.editRecordInUse(
        { type: 'Product', id: product.id.asString() },
        {
          applyToRelatedRecords: command.applyToRelatedRecords,
          changesOnlyCorrectableFields: changesOnlyName,
          before: { name: product.name().asString() },
          after: {
            name: (command.name ?? product.name()).asString(),
          },
        },
        async () => {
          if (command.name !== undefined) {
            product.rename(command.name);
          }
          if (command.components !== undefined) {
            componentLines ??= await this.componentLinesOf(command, product);
            // An unchanged composition is left as it is.
            if (!product.changesOnlyCorrectableFields(componentLines)) {
              product.updateComponents(componentLines);
            }
          }
          await this.productRepository.save(product);
        },
      );
    });
  }

  private componentLinesOf(
    command: EditProductCommand,
    product: Product,
  ): Promise<ProductComponentLine[]> {
    const components = command.components ?? [];
    assertCompositionInvariants(components);
    return this.compositionFactory.reconcileComponentLines(
      product.components(),
      components,
    );
  }
}
