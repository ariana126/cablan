import { EntityRepository } from '@framework/domain';

import { Component } from '../component.aggregate';
import { ComponentName } from '../value/component-name.vo';

export abstract class ComponentRepository extends EntityRepository<Component> {
  abstract findByName(name: ComponentName): Promise<Component | null>;

  abstract list(): Promise<Component[]>;

  /**
   * Hard delete: a component has no relations to any other BOM entity, so
   * nothing else must remain resolvable against it — unlike
   * `UserRepository`, there is no soft-delete counterpart on this port.
   */
  abstract delete(component: Component): Promise<void>;
}
