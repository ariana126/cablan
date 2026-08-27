import { Bom } from '@boms/domain/bom.aggregate';
import { BomRepository } from '@boms/domain/service/bom.repository';
import { EntityNotFound, Identity } from '@framework/domain';

// A hand-written fake, not a mock: `BomRepository` is an in-process
// collaborator from a handler's point of view, so tests use a real (if
// simplified) implementation rather than asserting on calls made to it.
export class InMemoryBomRepository extends BomRepository {
  private readonly bomsById = new Map<string, Bom>();

  find(id: Identity): Promise<Bom | null> {
    return Promise.resolve(this.bomsById.get(id.asString()) ?? null);
  }

  async get(id: Identity): Promise<Bom> {
    const bom = await this.find(id);
    if (!bom) {
      throw EntityNotFound.withId(id);
    }
    return bom;
  }

  save(entity: Bom): Promise<void> {
    this.bomsById.set(entity.id.asString(), entity);
    entity.releaseEvents();
    return Promise.resolve();
  }

  delete(bom: Bom): Promise<void> {
    this.bomsById.delete(bom.id.asString());
    bom.releaseEvents();
    return Promise.resolve();
  }

  list(): Promise<Bom[]> {
    return Promise.resolve([...this.bomsById.values()]);
  }

  seed(bom: Bom): Bom {
    this.bomsById.set(bom.id.asString(), bom);
    bom.releaseEvents();
    return bom;
  }
}
