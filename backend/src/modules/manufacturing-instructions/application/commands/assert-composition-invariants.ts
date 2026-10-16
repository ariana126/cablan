import {
  ManufacturingInstructionComponentMustHaveAtLeastOneMaterial,
  ManufacturingInstructionMustHaveAtLeastOneComponent,
} from '@manufacturing-instructions/application/exceptions';

import { RegisterManufacturingInstructionComponentInput } from './manufacturing-instruction-component.input';

// Shared by `RegisterManufacturingInstructionHandler` and `EditManufacturingInstructionHandler`, and
// checked before either dispatches `GetProductQuery`: a request that would
// violate either invariant is rejected on its own content before anything
// else is looked up.
export function assertCompositionInvariants(
  components: RegisterManufacturingInstructionComponentInput[],
): void {
  if (components.length === 0) {
    throw ManufacturingInstructionMustHaveAtLeastOneComponent.create();
  }
  for (const component of components) {
    if (component.materials.length === 0) {
      throw ManufacturingInstructionComponentMustHaveAtLeastOneMaterial.forComponent(
        component.componentId,
      );
    }
  }
}
