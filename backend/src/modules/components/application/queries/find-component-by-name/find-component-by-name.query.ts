import { ComponentName } from '@components/domain/value/component-name.vo';

// The read-side counterpart `ProductCompositionFactory` dispatches through
// the `QueryBus` to check whether a component name is already claimed by an
// earlier, unrelated product's own registration — before falling back to
// `RegisterComponentCommand`. See src/modules/products/CLAUDE.md and the
// narrow dependency-cruiser exception this relies on.
export class FindComponentByNameQuery {
  constructor(public readonly name: ComponentName) {}
}
