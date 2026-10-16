import { EntityNotFound, Identity } from '@framework/domain';
import { ManufacturingInstruction } from '@manufacturing-instructions/domain/manufacturing-instruction.aggregate';
import { ManufacturingInstructionRepository } from '@manufacturing-instructions/domain/service/manufacturing-instruction.repository';
import { MiCode } from '@manufacturing-instructions/domain/value/mi-code.vo';

// A hand-written fake, not a mock: `ManufacturingInstructionRepository` is an in-process
// collaborator from a handler's point of view, so tests use a real (if
// simplified) implementation rather than asserting on calls made to it.
export class InMemoryManufacturingInstructionRepository extends ManufacturingInstructionRepository {
  private readonly manufacturingInstructionsById = new Map<
    string,
    ManufacturingInstruction
  >();

  find(id: Identity): Promise<ManufacturingInstruction | null> {
    return Promise.resolve(
      this.manufacturingInstructionsById.get(id.asString()) ?? null,
    );
  }

  async get(id: Identity): Promise<ManufacturingInstruction> {
    const manufacturingInstruction = await this.find(id);
    if (!manufacturingInstruction) {
      throw EntityNotFound.withId(id);
    }
    return manufacturingInstruction;
  }

  findByMiCode(miCode: MiCode): Promise<ManufacturingInstruction | null> {
    for (const manufacturingInstruction of this.manufacturingInstructionsById.values()) {
      if (manufacturingInstruction.miCode().equals(miCode)) {
        return Promise.resolve(manufacturingInstruction);
      }
    }
    return Promise.resolve(null);
  }

  save(entity: ManufacturingInstruction): Promise<void> {
    this.manufacturingInstructionsById.set(entity.id.asString(), entity);
    entity.releaseEvents();
    return Promise.resolve();
  }

  delete(manufacturingInstruction: ManufacturingInstruction): Promise<void> {
    this.manufacturingInstructionsById.delete(
      manufacturingInstruction.id.asString(),
    );
    manufacturingInstruction.releaseEvents();
    return Promise.resolve();
  }

  list(): Promise<ManufacturingInstruction[]> {
    return Promise.resolve([...this.manufacturingInstructionsById.values()]);
  }

  seed(
    manufacturingInstruction: ManufacturingInstruction,
  ): ManufacturingInstruction {
    this.manufacturingInstructionsById.set(
      manufacturingInstruction.id.asString(),
      manufacturingInstruction,
    );
    manufacturingInstruction.releaseEvents();
    return manufacturingInstruction;
  }
}
