import { EntityNotFound, Identity } from '@framework/domain';
import { StandardBomRepository } from '@standard-boms/domain/service/standard-bom.repository';
import { StandardBom } from '@standard-boms/domain/standard-bom.aggregate';
import { MiCode } from '@standard-boms/domain/value/mi-code.vo';

// A hand-written fake, not a mock: `StandardBomRepository` is an in-process
// collaborator from a handler's point of view, so tests use a real (if
// simplified) implementation rather than asserting on calls made to it.
export class InMemoryStandardBomRepository extends StandardBomRepository {
  private readonly standardBomsById = new Map<string, StandardBom>();

  find(id: Identity): Promise<StandardBom | null> {
    return Promise.resolve(this.standardBomsById.get(id.asString()) ?? null);
  }

  async get(id: Identity): Promise<StandardBom> {
    const standardBom = await this.find(id);
    if (!standardBom) {
      throw EntityNotFound.withId(id);
    }
    return standardBom;
  }

  findByMiCode(miCode: MiCode): Promise<StandardBom | null> {
    for (const standardBom of this.standardBomsById.values()) {
      if (standardBom.miCode().equals(miCode)) {
        return Promise.resolve(standardBom);
      }
    }
    return Promise.resolve(null);
  }

  save(entity: StandardBom): Promise<void> {
    this.standardBomsById.set(entity.id.asString(), entity);
    entity.releaseEvents();
    return Promise.resolve();
  }

  delete(standardBom: StandardBom): Promise<void> {
    this.standardBomsById.delete(standardBom.id.asString());
    standardBom.releaseEvents();
    return Promise.resolve();
  }

  list(): Promise<StandardBom[]> {
    return Promise.resolve([...this.standardBomsById.values()]);
  }

  seed(standardBom: StandardBom): StandardBom {
    this.standardBomsById.set(standardBom.id.asString(), standardBom);
    standardBom.releaseEvents();
    return standardBom;
  }
}
