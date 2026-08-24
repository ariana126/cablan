import { EntityRepository } from '@framework/domain';

import { Material } from '../material.aggregate';
import { MaterialName } from '../value/material-name.vo';

export abstract class MaterialRepository extends EntityRepository<Material> {
  abstract findByName(name: MaterialName): Promise<Material | null>;

  abstract list(): Promise<Material[]>;

  /**
   * Hard delete: a material has no relations to any other BOM entity yet,
   * so nothing else must remain resolvable against it — unlike
   * `UserRepository`, there is no soft-delete counterpart on this port.
   */
  abstract delete(material: Material): Promise<void>;
}
