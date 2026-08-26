import {
  StandardBomComponentMustHaveAtLeastOneMaterial,
  StandardBomMustHaveAtLeastOneComponent,
} from '@standard-boms/application/exceptions';

import { RegisterStandardBomComponentInput } from './standard-bom-component.input';

// Shared by `RegisterStandardBomHandler` and `EditStandardBomHandler`, and
// checked before either dispatches `GetProductQuery`: a request that would
// violate either invariant is rejected on its own content before anything
// else is looked up.
export function assertCompositionInvariants(
  components: RegisterStandardBomComponentInput[],
): void {
  if (components.length === 0) {
    throw StandardBomMustHaveAtLeastOneComponent.create();
  }
  for (const component of components) {
    if (component.materials.length === 0) {
      throw StandardBomComponentMustHaveAtLeastOneMaterial.forComponent(
        component.componentId,
      );
    }
  }
}
