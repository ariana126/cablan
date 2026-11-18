import {
  ApplicationException,
  RecordDependencies,
  UnitOfWork,
} from '@framework/application';
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
      // Whether the composition is left as it is, or only reordered, can
      // only be told once the request's composition is resolved.
      let componentLines =
        command.components === undefined
          ? undefined
          : await this.resolvableComponentLinesOf(command, product);
      // The new order of component ids when the composition is only
      // reordered (issue #122); computed here, before `write` may reassign
      // `componentLines`.
      const reorderedComposition =
        componentLines !== undefined &&
        product.reordersComponents(componentLines)
          ? componentLines.map((line) => line.componentId().asString())
          : undefined;
      const changesOnlyName =
        command.components === undefined ||
        (componentLines !== undefined &&
          (reorderedComposition !== undefined ||
            product.changesOnlyCorrectableFields(componentLines)));

      // A record another record references can be neither edited nor
      // deleted (issue #94) — unless it is the System Admin's correction of
      // its name alone (issue #110), carried into its standard and daily
      // BOMs, or a reordering of its components (issue #122), carried the
      // same way, alone or riding along with that correction.
      await this.recordDependencies.editRecordInUse(
        { type: 'Product', id: product.id.asString() },
        {
          applyToRelatedRecords: command.applyToRelatedRecords,
          changesOnlyCorrectableFields: changesOnlyName,
          before: { name: product.name().asString() },
          after: {
            name: (command.name ?? product.name()).asString(),
          },
          reorderedComposition,
        },
        async () => {
          if (command.name !== undefined) {
            product.rename(command.name);
          }
          if (command.components !== undefined) {
            componentLines ??= await this.componentLinesOf(command, product);
            // An unchanged composition is left as it is.
            product.updateComponents(componentLines);
          }
          await this.productRepository.save(product);
        },
      );
    });
  }

  /**
   * The request's composition resolved — or `undefined` when it cannot be,
   * so that the edit of a product in use is still refused (409) before its
   * composition's own 400; resolving it again inside the edit then throws.
   */
  private async resolvableComponentLinesOf(
    command: EditProductCommand,
    product: Product,
  ): Promise<ProductComponentLine[] | undefined> {
    try {
      return await this.componentLinesOf(command, product);
    } catch (error) {
      if (error instanceof ApplicationException) {
        return undefined;
      }
      throw error;
    }
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
