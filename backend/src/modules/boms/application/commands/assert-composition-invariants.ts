import {
  BomComponentMustHaveAtLeastOneMaterial,
  BomMustHaveAtLeastOneComponent,
} from '@boms/application/exceptions';

import { BomComponentInput } from './bom-component.input';

// Shared by `RegisterBomHandler` and `EditBomHandler`, and checked before
// either dispatches `GetStandardBomByMiCodeQuery`: a request that would
// violate either invariant is rejected on its own content before anything
// else is looked up.
export function assertCompositionInvariants(
  components: BomComponentInput[],
): void {
  if (components.length === 0) {
    throw BomMustHaveAtLeastOneComponent.create();
  }
  for (const component of components) {
    if (component.materials.length === 0) {
      throw BomComponentMustHaveAtLeastOneMaterial.forComponent(
        component.componentId,
      );
    }
  }
}
