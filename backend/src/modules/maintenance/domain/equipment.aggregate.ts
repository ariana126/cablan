import { AggregateRoot, EntityNotFound, Identity } from '@framework/domain';

import { EquipmentRegistered } from './events/equipment-registered.event';
import { EquipmentRenamed } from './events/equipment-renamed.event';
import { EquipmentRetired } from './events/equipment-retired.event';
import { PmPlanItemAdded } from './events/pm-plan-item-added.event';
import { PmPlanItemIntervalChanged } from './events/pm-plan-item-interval-changed.event';
import { PmPlanItemRemoved } from './events/pm-plan-item-removed.event';
import { ActivityAlreadyInPmPlan } from './exceptions/activity-already-in-pm-plan.exception';
import { EquipmentIsRetired } from './exceptions/equipment-is-retired.exception';
import { PmPlanItemIsRemoved } from './exceptions/pm-plan-item-is-removed.exception';
import { MaintenanceActivity } from './maintenance-activity.aggregate';
import {
  MaintenanceExecution,
  Performer,
} from './maintenance-execution.aggregate';
import { PmOccurrences } from './pm-occurrences';
import { PmPlanItem, ReadonlyPmPlanItem } from './pm-plan-item.entity';
import { CalendarDate } from './value/calendar-date.vo';
import { EquipmentName } from './value/equipment-name.vo';
import { IntervalDays } from './value/interval-days.vo';
import { PmSchedule } from './value/pm-schedule.vo';

/**
 * A piece of equipment («تجهیز / دستگاه») and its preventive-maintenance
 * plan. It owns its plan items, so one activity appears at most once among
 * its active items, and retiring it stops its whole plan at once. Removing an
 * item or retiring the equipment is a soft stop: the item stays, so its
 * executions keep their history.
 */
export class Equipment extends AggregateRoot {
  private constructor(
    id: Identity,
    private _name: EquipmentName,
    private _retiredAt: Date | null,
    private readonly _planItems: PmPlanItem[],
  ) {
    super(id);
  }

  public static register(name: EquipmentName): Equipment {
    const equipment = new Equipment(Identity.new(), name, null, []);
    equipment.recordThat(
      new EquipmentRegistered(equipment.id.asString(), name.asString()),
    );
    return equipment;
  }

  /** Rehydrates from storage, plan items in the order they were added; records no event. */
  public static fromPersistence(
    id: Identity,
    name: EquipmentName,
    retiredAt: Date | null,
    planItems: PmPlanItem[],
  ): Equipment {
    return new Equipment(id, name, retiredAt, [...planItems]);
  }

  public rename(name: EquipmentName): void {
    this.assertInService();
    if (name.equals(this._name)) {
      return;
    }
    const previousName = this._name;
    this._name = name;
    this.recordThat(
      new EquipmentRenamed(
        this.id.asString(),
        previousName.asString(),
        name.asString(),
      ),
    );
  }

  public retire(now: Date): void {
    this.assertInService();
    this._retiredAt = now;
    this.recordThat(
      new EquipmentRetired(this.id.asString(), this._name.asString()),
    );
  }

  public addPlanItem(
    activity: MaintenanceActivity,
    intervalDays: IntervalDays,
    firstDueDate: CalendarDate,
  ): ReadonlyPmPlanItem {
    this.assertInService();
    if (
      this.activePlanItems().some((item) =>
        item.activityId().equals(activity.id),
      )
    ) {
      throw ActivityAlreadyInPmPlan.of(
        this.id.asString(),
        activity.id.asString(),
      );
    }
    const item = PmPlanItem.add(
      activity.id,
      activity.name().asString(),
      PmSchedule.startingOn(firstDueDate, intervalDays),
    );
    this._planItems.push(item);
    this.recordThat(
      new PmPlanItemAdded(
        this.id.asString(),
        this._name.asString(),
        item.id.asString(),
        activity.id.asString(),
        activity.name().asString(),
        intervalDays.asNumber(),
        firstDueDate.asString(),
      ),
    );
    return item;
  }

  /**
   * The interval changed, in force from `effectiveFromDueDate` — one of the
   * item's due dates, chosen by `PmOccurrences.intervalChangeStart()` so the
   * due dates before it, and every one already done, stay as they were.
   */
  public changePlanItemInterval(
    planItemId: Identity,
    intervalDays: IntervalDays,
    effectiveFromDueDate: CalendarDate,
  ): void {
    const item = this.planItemOpenForWork(planItemId);
    const previousIntervalDays = item.schedule().intervalDays();
    if (previousIntervalDays.equals(intervalDays)) {
      return;
    }
    item.changeIntervalFrom(effectiveFromDueDate, intervalDays);
    this.recordThat(
      new PmPlanItemIntervalChanged(
        this.id.asString(),
        this._name.asString(),
        item.id.asString(),
        item.activityName(),
        previousIntervalDays.asNumber(),
        intervalDays.asNumber(),
        effectiveFromDueDate.asString(),
      ),
    );
  }

  public removePlanItem(planItemId: Identity, now: Date): void {
    const item = this.planItemOpenForWork(planItemId);
    item.removeAt(now);
    this.recordThat(
      new PmPlanItemRemoved(
        this.id.asString(),
        this._name.asString(),
        item.id.asString(),
        item.activityName(),
      ),
    );
  }

  /**
   * That `activity`'s job on this item was done at `performedAt` by
   * `performer`: an execution of the item's next due occurrence, given the
   * item's `executions` so far. The execution is its own aggregate — this
   * records no event of the equipment's; the caller saves what it returns.
   */
  public recordExecutionOf(
    planItemId: Identity,
    activity: MaintenanceActivity,
    executions: readonly MaintenanceExecution[],
    performedAt: Date,
    performer: Performer,
    notes: string | null,
  ): MaintenanceExecution {
    const item = this.planItemOpenForWork(planItemId);
    if (!item.activityId().equals(activity.id)) {
      throw new Error(
        `Activity ${activity.id.asString()} is not the one plan item ${planItemId.asString()} schedules`,
      );
    }
    const dueDate = new PmOccurrences(
      item.schedule(),
      executions.filter((execution) => execution.planItemId().equals(item.id)),
    ).nextDueDate(CalendarDate.inTehranOf(performedAt));

    return MaintenanceExecution.record({
      equipmentId: this.id,
      equipmentName: this._name.asString(),
      planItemId: item.id,
      activityId: activity.id,
      activityName: activity.name().asString(),
      dueDate,
      performedAt,
      performedById: performer.id,
      performedByName: performer.name,
      notes,
    });
  }

  /**
   * The plan item, provided it can still take work — an execution, an
   * interval change, a removal: the equipment in service and the item not
   * removed.
   */
  public activePlanItem(planItemId: Identity): ReadonlyPmPlanItem {
    return this.planItemOpenForWork(planItemId);
  }

  public name(): EquipmentName {
    return this._name;
  }

  public retiredAt(): Date | null {
    return this._retiredAt;
  }

  public isRetired(): boolean {
    return this._retiredAt !== null;
  }

  /** Every item ever added, removed ones included, in the order they were added. */
  public planItems(): readonly ReadonlyPmPlanItem[] {
    return [...this._planItems];
  }

  /** The items not removed, in the order they were added. */
  public activePlanItems(): readonly ReadonlyPmPlanItem[] {
    return this._planItems.filter((item) => !item.isRemoved());
  }

  private planItemOpenForWork(planItemId: Identity): PmPlanItem {
    const item = this._planItems.find((candidate) =>
      candidate.id.equals(planItemId),
    );
    if (!item) {
      throw EntityNotFound.withId(planItemId);
    }
    this.assertInService();
    if (item.isRemoved()) {
      throw PmPlanItemIsRemoved.withId(planItemId.asString());
    }
    return item;
  }

  private assertInService(): void {
    if (this.isRetired()) {
      throw EquipmentIsRetired.withId(this.id.asString());
    }
  }
}
