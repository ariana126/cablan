import { DomainEvent, EntityNotFound, Identity } from '@framework/domain';
import { MaintenanceExecution } from '@maintenance/domain/maintenance-execution.aggregate';
import { MaintenanceExecutionRepository } from '@maintenance/domain/service/maintenance-execution.repository';

export class InMemoryMaintenanceExecutionRepository extends MaintenanceExecutionRepository {
  private readonly executionsById = new Map<string, MaintenanceExecution>();
  readonly savedEvents: DomainEvent[] = [];

  find(id: Identity): Promise<MaintenanceExecution | null> {
    return Promise.resolve(this.executionsById.get(id.asString()) ?? null);
  }

  async get(id: Identity): Promise<MaintenanceExecution> {
    const execution = await this.find(id);
    if (!execution) {
      throw EntityNotFound.withId(id);
    }
    return execution;
  }

  save(entity: MaintenanceExecution): Promise<void> {
    this.executionsById.set(entity.id.asString(), entity);
    this.savedEvents.push(...entity.releaseEvents());
    return Promise.resolve();
  }

  forPlanItem(planItemId: Identity): Promise<MaintenanceExecution[]> {
    return Promise.resolve(
      [...this.executionsById.values()].filter((execution) =>
        execution.planItemId().equals(planItemId),
      ),
    );
  }

  forEquipment(equipmentId: Identity): Promise<MaintenanceExecution[]> {
    return Promise.resolve(
      [...this.executionsById.values()].filter((execution) =>
        execution.equipmentId().equals(equipmentId),
      ),
    );
  }

  forEquipments(
    equipmentIds: readonly Identity[],
  ): Promise<MaintenanceExecution[]> {
    return Promise.resolve(
      [...this.executionsById.values()].filter((execution) =>
        equipmentIds.some((id) => id.equals(execution.equipmentId())),
      ),
    );
  }

  all(): MaintenanceExecution[] {
    return [...this.executionsById.values()];
  }

  seed(execution: MaintenanceExecution): MaintenanceExecution {
    this.executionsById.set(execution.id.asString(), execution);
    execution.releaseEvents();
    return execution;
  }
}
