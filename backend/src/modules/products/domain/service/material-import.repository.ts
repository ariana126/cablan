import { EntityRepository } from '@framework/domain';

import { MaterialImport } from '../material-import.aggregate';

export abstract class MaterialImportRepository extends EntityRepository<MaterialImport> {
  /**
   * The newest import not yet reverted — the only one that may be reverted.
   * Newest is by `importedAt`, then by insertion order for imports recorded
   * at the same instant (the test stack's clock is frozen).
   */
  abstract findLatestNotReverted(): Promise<MaterialImport | null>;
}
