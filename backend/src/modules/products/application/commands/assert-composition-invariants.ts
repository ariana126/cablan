import {
  ProductComponentMustHaveAtLeastOneMaterial,
  ProductMustHaveAtLeastOneComponent,
} from '@products/application/exceptions';

import { RegisterProductComponentInput } from './product-component.input';

// Shared by `RegisterProductHandler` and `EditProductHandler`, and checked
// before either dispatches a single `RegisterComponentCommand`/
// `RegisterMaterialCommand`: a request that would violate either invariant
// must never leave an orphaned `Component`/`Material` row behind.
export function assertCompositionInvariants(
  components: RegisterProductComponentInput[],
): void {
  if (components.length === 0) {
    throw ProductMustHaveAtLeastOneComponent.create();
  }
  for (const component of components) {
    if (component.materials.length === 0) {
      throw ProductComponentMustHaveAtLeastOneMaterial.forComponent(
        component.name,
      );
    }
  }
}
