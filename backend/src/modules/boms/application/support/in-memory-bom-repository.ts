import { Bom } from '@boms/domain/bom.aggregate';
import { BomRepository } from '@boms/domain/service/bom.repository';
import { EntityNotFound, Identity } from '@framework/domain';

// A hand-written fake, not a mock: `BomRepository` is an in-process
// collaborator from a handler's point of view, so tests use a real (if
// simplified) implementation rather than asserting on calls made to it.
export class InMemoryBomRepository extends BomRepository {
  private readonly bomsById = new Map<string, Bom>();
  private readonly saveCountsById = new Map<string, number>();

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
    const id = entity.id.asString();
    this.bomsById.set(id, entity);
    this.saveCountsById.set(id, this.timesSaved(entity.id) + 1);
    entity.releaseEvents();
    return Promise.resolve();
  }

  // No concurrency to serialise in memory: load, change, save.
  async modify(id: Identity, change: (bom: Bom) => void): Promise<void> {
    const bom = await this.get(id);
    change(bom);
    await this.save(bom);
  }

  delete(bom: Bom): Promise<void> {
    this.bomsById.delete(bom.id.asString());
    bom.releaseEvents();
    return Promise.resolve();
  }

  list(): Promise<Bom[]> {
    return Promise.resolve([...this.bomsById.values()]);
  }

  // How many times `save()` was called for this BOM — `seed()` does not
  // count. Lets a handler test prove a no-op command writes nothing.
  timesSaved(id: Identity): number {
    return this.saveCountsById.get(id.asString()) ?? 0;
  }

  seed(bom: Bom): Bom {
    this.bomsById.set(bom.id.asString(), bom);
    bom.releaseEvents();
    return bom;
  }
}
