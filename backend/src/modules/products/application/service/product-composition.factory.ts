import { RegisterComponentCommand } from '@components/application/commands/register-component/register-component.command';
import { ComponentName } from '@components/domain/value/component-name.vo';
import { Identity } from '@framework/domain';
import { RegisterMaterialCommand } from '@materials/application/commands/register-material/register-material.command';
import { MaterialName } from '@materials/domain/value/material-name.vo';
import { Injectable } from '@nestjs/common';
import { CommandBus } from '@nestjs/cqrs';
import {
  EditProductComponentInput,
  EditProductMaterialInput,
  RegisterProductComponentInput,
} from '@products/application/commands/product-component.input';
import { ProductCompositionEntryNotFound } from '@products/application/exceptions';
import { ProductComponentLine } from '@products/domain/value/product-component-line.vo';
import { ProductMaterialLine } from '@products/domain/value/product-material-line.vo';

/**
 * Builds a product's component composition. Two distinct operations, kept as
 * two methods rather than one branching on a flag:
 *
 * - `createComponentLines` (registration): every component — and every
 *   material within it — is *created* as a real new row in the `components`
 *   and `materials` master tables. There is never a pre-existing composition
 *   to consider.
 * - `reconcileComponentLines` (editing): a component/material entry that
 *   carries an `id` refers to one already in the product's *current*
 *   composition and is kept as-is, verbatim — no new registration, no
 *   collision with its own name. An entry with no `id` is registered as new,
 *   exactly like `createComponentLines` does. An `id` that isn't actually
 *   part of the current composition (of the product being edited, and — for
 *   a material — of the specific component referenced) throws
 *   `ProductCompositionEntryNotFound` rather than silently accepting it.
 *   Renaming an existing component/material through a product edit is out of
 *   scope: a reused entry keeps its recorded name regardless of what the
 *   request's `name` field says, since no scenario needs a rename and this
 *   is the smaller, well-scoped behaviour.
 *
 * Both dispatch through the `CommandBus` and reuse
 * `RegisterComponentCommand`/`RegisterMaterialCommand` verbatim for new
 * entries, so their modules' own name-validation and uniqueness rules apply
 * for free; this factory reimplements none of them. See
 * src/modules/products/CLAUDE.md for the full reasoning and the narrow
 * dependency-cruiser exception this relies on.
 */
@Injectable()
export class ProductCompositionFactory {
  constructor(private readonly commandBus: CommandBus) {}

  async createComponentLines(
    components: RegisterProductComponentInput[],
  ): Promise<ProductComponentLine[]> {
    const lines: ProductComponentLine[] = [];
    for (const component of components) {
      lines.push(await this.createComponentLine(component));
    }
    return lines;
  }

  async reconcileComponentLines(
    existingComponents: ProductComponentLine[],
    components: EditProductComponentInput[],
  ): Promise<ProductComponentLine[]> {
    const lines: ProductComponentLine[] = [];
    for (const component of components) {
      lines.push(
        await this.reconcileComponentLine(existingComponents, component),
      );
    }
    return lines;
  }

  private async createComponentLine(
    component: RegisterProductComponentInput,
  ): Promise<ProductComponentLine> {
    const componentName = ComponentName.fromString(component.name);
    const { id: componentId } = await this.commandBus.execute<
      RegisterComponentCommand,
      { id: string }
    >(new RegisterComponentCommand(componentName));

    const materialLines: ProductMaterialLine[] = [];
    for (const material of component.materials) {
      materialLines.push(await this.createMaterialLine(material.name));
    }

    return ProductComponentLine.of(
      Identity.fromString(componentId),
      componentName.asString(),
      materialLines,
    );
  }

  private async reconcileComponentLine(
    existingComponents: ProductComponentLine[],
    component: EditProductComponentInput,
  ): Promise<ProductComponentLine> {
    const existingLine = ProductCompositionFactory.findExisting(
      existingComponents,
      component.id,
      (line) => line.componentId(),
      (id) => ProductCompositionEntryNotFound.forComponent(id),
    );

    const materialLines = await this.reconcileMaterialLines(
      existingLine?.materials() ?? [],
      component.materials,
    );

    if (existingLine !== undefined) {
      return ProductComponentLine.of(
        existingLine.componentId(),
        existingLine.name(),
        materialLines,
      );
    }

    const componentName = ComponentName.fromString(component.name);
    const { id: componentId } = await this.commandBus.execute<
      RegisterComponentCommand,
      { id: string }
    >(new RegisterComponentCommand(componentName));
    return ProductComponentLine.of(
      Identity.fromString(componentId),
      componentName.asString(),
      materialLines,
    );
  }

  private async reconcileMaterialLines(
    existingMaterials: ProductMaterialLine[],
    materials: EditProductMaterialInput[],
  ): Promise<ProductMaterialLine[]> {
    const lines: ProductMaterialLine[] = [];
    for (const material of materials) {
      lines.push(await this.reconcileMaterialLine(existingMaterials, material));
    }
    return lines;
  }

  private async reconcileMaterialLine(
    existingMaterials: ProductMaterialLine[],
    material: EditProductMaterialInput,
  ): Promise<ProductMaterialLine> {
    const existingLine = ProductCompositionFactory.findExisting(
      existingMaterials,
      material.id,
      (line) => line.materialId(),
      (id) => ProductCompositionEntryNotFound.forMaterial(id),
    );
    if (existingLine !== undefined) {
      return existingLine;
    }
    return this.createMaterialLine(material.name);
  }

  private async createMaterialLine(name: string): Promise<ProductMaterialLine> {
    const materialName = MaterialName.fromString(name);
    const { id: materialId } = await this.commandBus.execute<
      RegisterMaterialCommand,
      { id: string }
    >(new RegisterMaterialCommand(materialName));
    return ProductMaterialLine.of(
      Identity.fromString(materialId),
      materialName.asString(),
    );
  }

  // Shared lookup for both composition levels: an entry with no `id` isn't
  // being reconciled at all (undefined, so the caller registers it as new);
  // an entry with an `id` must resolve to a line already present in the
  // current composition, or the edit is rejected outright.
  private static findExisting<Line>(
    existingLines: Line[],
    id: string | undefined,
    identityOf: (line: Line) => Identity,
    onNotFound: (id: string) => Error,
  ): Line | undefined {
    if (id === undefined) {
      return undefined;
    }
    const line = existingLines.find(
      (candidate) => identityOf(candidate).asString() === id,
    );
    if (line === undefined) {
      throw onNotFound(id);
    }
    return line;
  }
}
