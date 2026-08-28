import { MaterialName } from '@materials/domain/value/material-name.vo';

// The read-side counterpart `ProductCompositionFactory` dispatches through
// the `QueryBus` to check whether a material name is already claimed by an
// earlier, unrelated product's own registration — before falling back to
// `RegisterMaterialCommand`. See src/modules/products/CLAUDE.md and the
// narrow dependency-cruiser exception this relies on.
export class FindMaterialByNameQuery {
  constructor(public readonly name: MaterialName) {}
}
