import { DomainEvent, EntityNotFound, Identity } from '@framework/domain';
import { QcExecution } from '@maintenance/domain/qc-execution.aggregate';
import { QcExecutionRepository } from '@maintenance/domain/service/qc-execution.repository';

// A hand-written fake, not a mock. It keeps the records in the order they
// were saved, which is the order "made at one instant" falls back on.
export class InMemoryQcExecutionRepository extends QcExecutionRepository {
  private readonly executionsById = new Map<string, QcExecution>();
  readonly savedEvents: DomainEvent[] = [];

  find(id: Identity): Promise<QcExecution | null> {
    return Promise.resolve(this.executionsById.get(id.asString()) ?? null);
  }

  async get(id: Identity): Promise<QcExecution> {
    const execution = await this.find(id);
    if (!execution) {
      throw EntityNotFound.withId(id);
    }
    return execution;
  }

  save(entity: QcExecution): Promise<void> {
    this.executionsById.set(entity.id.asString(), entity);
    this.savedEvents.push(...entity.releaseEvents());
    return Promise.resolve();
  }

  delete(entity: QcExecution): Promise<void> {
    this.executionsById.delete(entity.id.asString());
    this.savedEvents.push(...entity.releaseEvents());
    return Promise.resolve();
  }

  ofEquipment(equipmentId: Identity): Promise<QcExecution[]> {
    return Promise.resolve(
      this.all().filter((execution) =>
        execution.equipmentId().equals(equipmentId),
      ),
    );
  }

  /** Every record, in the order they were saved. */
  all(): QcExecution[] {
    return [...this.executionsById.values()];
  }

  seed(execution: QcExecution): QcExecution {
    this.executionsById.set(execution.id.asString(), execution);
    execution.releaseEvents();
    return execution;
  }
}
