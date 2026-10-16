import { Identity } from '@framework/domain';
import { Injectable } from '@nestjs/common';
import {
  EditProductComponentInput,
  EditProductMaterialInput,
  RegisterProductComponentInput,
} from '@products/application/commands/product-component.input';
import {
  ComponentNotRegistered,
  MaterialNotRegistered,
  ProductCompositionEntryNotFound,
} from '@products/application/exceptions';
import { ComponentRepository } from '@products/domain/service/component.repository';
import { MaterialRepository } from '@products/domain/service/material.repository';
import { ComponentName } from '@products/domain/value/component-name.vo';
import { MaterialName } from '@products/domain/value/material-name.vo';
import { ProductComponentLine } from '@products/domain/value/product-component-line.vo';
import { ProductMaterialLine } from '@products/domain/value/product-material-line.vo';

/**
 * Builds a product's component composition. Two distinct operations, kept as
 * two methods rather than one branching on a flag:
 *
 * - `createComponentLines` (registration): every component/material entry is
 *   resolved to a `Component`/`Material` that is already registered (see the
 *   name-resolution note below). There is never a pre-existing
 *   *product* composition to consider on registration.
 * - `reconcileComponentLines` (editing): a component/material entry that
 *   carries an `id` refers to one already in the product's *current*
 *   composition and is kept as-is, verbatim — no name resolution. An entry
 *   with no `id` is resolved exactly like `createComponentLines` does. An
 *   `id` that isn't actually part of the current composition (of the product
 *   being edited, and — for a material — of the specific component
 *   referenced) throws `ProductCompositionEntryNotFound` rather than
 *   silently accepting it. Renaming an existing component/material through a
 *   product edit is out of scope: a reused entry keeps its recorded name
 *   regardless of what the request's `name` field says, since no scenario
 *   needs a rename and this is the smaller, well-scoped behaviour.
 *
 * **Name resolution.** For every component/material name that isn't reused
 * verbatim from the product's own current composition (i.e. every entry
 * `createComponentLines` handles, and every id-less new entry
 * `reconcileComponentLines` handles), this factory asks
 * `ComponentRepository.findByName`/`MaterialRepository.findByName` whether a
 * `Component`/`Material` with that exact name already exists **globally** —
 * "Copper", "Core", "Jacket" are raw-material/component vocabulary real
 * products legitimately share, not reinvent per product — and reuses its id
 * if so. A name that resolves to nothing is rejected outright, with
 * `ComponentNotRegistered`/`MaterialNotRegistered`: registering or editing a
 * product must never mint a new `Component`/`Material` on the spot, so only
 * a name already registered through `POST /components`/`POST /materials` is
 * valid to use in a product's composition. Materials, components and
 * products are one module, so the factory reads the two repositories
 * directly — see src/modules/products/CLAUDE.md.
 *
 * `createComponentLines` additionally deduplicates materials **within one
 * registration request**, on top of the global lookup above: the same
 * material name legitimately appears under two different components of one
 * product (e.g. "مسی" used by both "مغزی" and "روکش"), and that is one
 * request meaning "both components use this same raw material" — not two
 * independent materials that happen to collide. A `Map<string,
 * ProductMaterialLine>` keyed by material name is built fresh per call (never
 * as instance state — this service is a singleton reused across requests)
 * and threaded through the loop over `components`; a name already seen
 * earlier in the same request reuses that material's id without a second
 * lookup. Components are not deduplicated the same way: no known
 * scenario needs the same component name reused across two components of one
 * product — though the global by-name lookup above still applies to each one
 * individually.
 */
@Injectable()
export class ProductCompositionFactory {
  constructor(
    private readonly componentRepository: ComponentRepository,
    private readonly materialRepository: MaterialRepository,
  ) {}

  async createComponentLines(
    components: RegisterProductComponentInput[],
  ): Promise<ProductComponentLine[]> {
    const materialLinesByName = new Map<string, ProductMaterialLine>();
    const lines: ProductComponentLine[] = [];
    for (const component of components) {
      lines.push(
        await this.createComponentLine(component, materialLinesByName),
      );
    }
    return lines;
  }

  // Deliberately asymmetric with createComponentLines: this does not
  // deduplicate a material name newly introduced twice across two new
  // (id-less) entries within one edit request. `registring-product.feature`
  // has no scenario that reuses a material name across components within a
  // single edit, so it isn't worth the extra complexity here — see
  // createComponentLines' doc comment for the registration-side behaviour
  // this would mirror if a scenario ever needs it.
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
    materialLinesByName: Map<string, ProductMaterialLine>,
  ): Promise<ProductComponentLine> {
    const componentName = ComponentName.fromString(component.name);
    const componentId = await this.resolveComponentId(componentName);

    const materialLines: ProductMaterialLine[] = [];
    for (const material of component.materials) {
      materialLines.push(
        await this.createOrReuseMaterialLine(
          material.name,
          materialLinesByName,
        ),
      );
    }

    return ProductComponentLine.of(
      componentId,
      componentName.asString(),
      materialLines,
    );
  }

  // Resolves a component name to the id of the `Component` already
  // registered under this exact name — by this product or an earlier,
  // unrelated one. A name that resolves to nothing is rejected with
  // `ComponentNotRegistered` — this factory never registers a new component
  // on the caller's behalf. See the class doc comment's "Name resolution"
  // note.
  private async resolveComponentId(
    componentName: ComponentName,
  ): Promise<Identity> {
    const existing = await this.componentRepository.findByName(componentName);
    if (existing === null) {
      throw ComponentNotRegistered.withName(componentName.asString());
    }
    return existing.id;
  }

  // Reuses a material already resolved earlier in this same registration
  // request (see the class doc comment) without a second repository lookup,
  // falling through to `createMaterialLine`'s own global lookup on a cache
  // miss.
  private async createOrReuseMaterialLine(
    name: string,
    materialLinesByName: Map<string, ProductMaterialLine>,
  ): Promise<ProductMaterialLine> {
    const materialName = MaterialName.fromString(name);
    const cached = materialLinesByName.get(materialName.asString());
    if (cached !== undefined) {
      return cached;
    }
    const line = await this.createMaterialLine(materialName.asString());
    materialLinesByName.set(materialName.asString(), line);
    return line;
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
    const componentId = await this.resolveComponentId(componentName);
    return ProductComponentLine.of(
      componentId,
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
    const materialId = await this.resolveMaterialId(materialName);
    return ProductMaterialLine.of(materialId, materialName.asString());
  }

  // Resolves a material name to the id of the `Material` already registered
  // under this exact name — by this product or an earlier, unrelated one. A
  // name that resolves to nothing is rejected with `MaterialNotRegistered` —
  // this factory never registers a new material on the caller's behalf. See
  // the class doc comment's "Name resolution" note. Shared by both
  // `createMaterialLine` callers, so the global lookup applies equally to
  // registration's fresh materials and an edit's new (id-less) ones.
  private async resolveMaterialId(
    materialName: MaterialName,
  ): Promise<Identity> {
    const existing = await this.materialRepository.findByName(materialName);
    if (existing === null) {
      throw MaterialNotRegistered.withName(materialName.asString());
    }
    return existing.id;
  }

  // Shared lookup for both composition levels: an entry with no `id` isn't
  // being reconciled at all (undefined, so the caller resolves it as new);
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
