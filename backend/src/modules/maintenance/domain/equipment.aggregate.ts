import { AggregateRoot, EntityNotFound, Identity } from '@framework/domain';

import { EquipmentDeleted } from './events/equipment-deleted.event';
import { EquipmentReactivated } from './events/equipment-reactivated.event';
import { EquipmentRegistered } from './events/equipment-registered.event';
import { EquipmentRenamed } from './events/equipment-renamed.event';
import { EquipmentRetired } from './events/equipment-retired.event';
import { PmPlanItemAdded } from './events/pm-plan-item-added.event';
import { PmPlanItemDeactivated } from './events/pm-plan-item-deactivated.event';
import { PmPlanItemDeleted } from './events/pm-plan-item-deleted.event';
import { PmPlanItemIntervalChanged } from './events/pm-plan-item-interval-changed.event';
import { ActivityAlreadyInPmPlan } from './exceptions/activity-already-in-pm-plan.exception';
import { EquipmentIsRetired } from './exceptions/equipment-is-retired.exception';
import { EquipmentNotRetired } from './exceptions/equipment-not-retired.exception';
import { InvalidReactivationItem } from './exceptions/invalid-reactivation-item.exception';
import { PmPlanItemIsActive } from './exceptions/pm-plan-item-is-active.exception';
import { PmPlanItemIsDeactivated } from './exceptions/pm-plan-item-is-deactivated.exception';
import { ReactivationFirstDueDateInPast } from './exceptions/reactivation-first-due-date-in-past.exception';
import { MaintenanceActivity } from './maintenance-activity.aggregate';
import {
  ExecutionReport,
  MaintenanceExecution,
  Performer,
} from './maintenance-execution.aggregate';
import { ExecutedOccurrence, PmOccurrences } from './pm-occurrences';
import {
  DeactivatedPmPlanItem,
  PmPlanItem,
  ReadonlyPmPlanItem,
} from './pm-plan-item.entity';
import { CalendarDate } from './value/calendar-date.vo';
import { EquipmentName } from './value/equipment-name.vo';
import { IntervalDays } from './value/interval-days.vo';
import { MaintenanceActivityName } from './value/maintenance-activity-name.vo';
import { PmSchedule } from './value/pm-schedule.vo';
import { ServiceBreak } from './value/service-break.vo';
import { ServiceGap } from './value/service-gap.vo';

/** A row given a new first due date when its equipment is reactivated. */
export interface RescheduledPlanItem {
  readonly planItemId: Identity;
  readonly firstDueDate: CalendarDate;
}

/**
 * A piece of equipment («تجهیز / دستگاه») and its preventive-maintenance
 * plan. It owns its plan items, so one activity appears at most once among
 * its active items, and retiring it stops its whole plan at once. Deactivating an
 * item or retiring the equipment is a soft stop: the item stays, so its
 * executions keep their history.
 *
 * Issue #110: retiring opens a `ServiceBreak` and reactivating closes it, as
 * often as the System Admin likes; the equipment is retired while its last
 * break is open. No due date of a break's days is generated. Only the System
 * Admin deletes an inactive row or retired equipment, which the handlers
 * guard by role.
 */
export class Equipment extends AggregateRoot {
  private constructor(
    id: Identity,
    private _name: EquipmentName,
    private _serviceBreaks: readonly ServiceBreak[],
    private _planItems: PmPlanItem[],
  ) {
    super(id);
  }

  public static register(name: EquipmentName): Equipment {
    const equipment = new Equipment(Identity.new(), name, [], []);
    equipment.recordThat(
      new EquipmentRegistered(equipment.id.asString(), name.asString()),
    );
    return equipment;
  }

  /**
   * Rehydrates from storage, service breaks oldest first and plan items in
   * the order they were added; records no event. Only the last break may
   * still be open.
   */
  public static fromPersistence(
    id: Identity,
    name: EquipmentName,
    serviceBreaks: readonly ServiceBreak[],
    planItems: PmPlanItem[],
  ): Equipment {
    if (
      serviceBreaks.slice(0, -1).some((serviceBreak) => serviceBreak.isOpen())
    ) {
      throw new Error(
        `Equipment ${id.asString()} has a service break left open before its last`,
      );
    }
    return new Equipment(id, name, [...serviceBreaks], [...planItems]);
  }

  public rename(name: EquipmentName): void {
    this.assertInService();
    this.correctName(name);
  }

  /**
   * The System Admin's correction of its name (issue #110): a rename that
   * retired equipment takes too, leaving it retired. The handler carries it
   * into the history's snapshots.
   */
  public correctName(name: EquipmentName): void {
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

  /**
   * Whether an edit changes nothing but correctable fields (issue #110):
   * always — its name, its only editable field, is correctable.
   */
  public changesOnlyCorrectableFields(): boolean {
    return true;
  }

  public retire(now: Date): void {
    this.assertInService();
    this._serviceBreaks = [
      ...this._serviceBreaks,
      ServiceBreak.startingAt(now),
    ];
    this.recordThat(
      new EquipmentRetired(this.id.asString(), this._name.asString()),
    );
  }

  /**
   * Back in service at `now` (issue #110). Each `rescheduled` row — an
   * active row, once — restarts from its new first due date, no earlier
   * than the Tehran reactivation day, keeping its interval; every other
   * active row continues its previous calendar. Deactivated rows stay
   * deactivated. Everything is checked before anything changes.
   */
  public reactivate(
    now: Date,
    rescheduled: readonly RescheduledPlanItem[],
  ): void {
    const openBreak = this.openServiceBreak();
    if (!openBreak) {
      throw EquipmentNotRetired.withId(this.id.asString());
    }
    const today = CalendarDate.inTehranOf(now);
    const restarts = this.restartsOf(rescheduled, today);

    this._serviceBreaks = [
      ...this._serviceBreaks.slice(0, -1),
      openBreak.endingAt(now),
    ];
    for (const { item, firstDueDate } of restarts) {
      item.restartOn(today, firstDueDate);
    }
    this.recordThat(
      new EquipmentReactivated(
        this.id.asString(),
        this._name.asString(),
        restarts.map(({ item, firstDueDate }) => ({
          planItemId: item.id.asString(),
          activityName: item.activityName(),
          firstDueDate: firstDueDate.asString(),
        })),
      ),
    );
  }

  /**
   * Retired equipment deleted with its whole plan (issue #110); the
   * repository's `delete()` removes it, and the handler every execution of
   * its rows.
   */
  public delete(): void {
    if (!this.isRetired()) {
      throw EquipmentNotRetired.withId(this.id.asString());
    }
    this.recordThat(
      new EquipmentDeleted(this.id.asString(), this._name.asString()),
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

  public deactivatePlanItem(planItemId: Identity, now: Date): void {
    const item = this.planItemOpenForWork(planItemId);
    item.deactivateAt(now);
    this.recordThat(
      new PmPlanItemDeactivated(
        this.id.asString(),
        this._name.asString(),
        item.id.asString(),
        item.activityName(),
      ),
    );
  }

  /**
   * An inactive row deleted from the plan (issue #110), retired equipment
   * included; the handler deletes its executions. An active row is
   * deactivated first.
   */
  public deletePlanItem(planItemId: Identity): void {
    const item = this.planItemWithId(planItemId);
    if (!item.isDeactivated()) {
      throw PmPlanItemIsActive.withId(planItemId.asString());
    }
    this._planItems = this._planItems.filter(
      (candidate) => !candidate.id.equals(planItemId),
    );
    this.recordThat(
      new PmPlanItemDeleted(
        this.id.asString(),
        this._name.asString(),
        item.id.asString(),
        item.activityName(),
      ),
    );
  }

  /**
   * The item's job was done at `performedAt` by `performer`: an execution of
   * the item's next due occurrence, given the item's `executions` so far, with
   * what the performer `report`ed (notes, operating hours). The
   * activity is the one the item schedules; `activityName` is what it is
   * called now, for the history to keep (the item's own copy dates from when
   * it was added). The execution is its own aggregate — this records no event
   * of the equipment's; the caller saves what it returns.
   */
  public recordExecutionOf(
    planItemId: Identity,
    activityName: MaintenanceActivityName,
    executions: readonly MaintenanceExecution[],
    performedAt: Date,
    performer: Performer,
    report: ExecutionReport,
  ): MaintenanceExecution {
    const item = this.planItemOpenForWork(planItemId);
    const dueDate = this.occurrencesInForceOf(
      item,
      executions.filter((execution) => execution.planItemId().equals(item.id)),
    ).nextDueDate(CalendarDate.inTehranOf(performedAt));

    return MaintenanceExecution.record({
      equipmentId: this.id,
      equipmentName: this._name.asString(),
      planItemId: item.id,
      activityId: item.activityId(),
      activityName: activityName.asString(),
      dueDate,
      performedAt,
      performedById: performer.id,
      performedByName: performer.name,
      notes: report.notes,
      operatingHours: report.operatingHours,
    });
  }

  /**
   * `item`'s occurrences as its history stands: up to the day it was
   * deactivated, none while this equipment was out of service — still
   * retired included — unless done anyway. What every range read, the
   * dashboard and the calendar judge it by.
   */
  public occurrencesOf<E extends ExecutedOccurrence>(
    item: ReadonlyPmPlanItem,
    executions: readonly E[],
  ): PmOccurrences<E> {
    const deactivatedAt = item.deactivatedAt();
    return new PmOccurrences(
      item.schedule(),
      executions,
      deactivatedAt ? CalendarDate.inTehranOf(deactivatedAt) : null,
      this.gaps(),
    );
  }

  /**
   * `item`'s occurrences judged as in force, with no stop date — none in a
   * service gap that ended: what the write paths (recording, an interval
   * change) and the reads of what is next (the daily list, the detail, a
   * retired equipment's next due dates included) use.
   */
  public occurrencesInForceOf<E extends ExecutedOccurrence>(
    item: ReadonlyPmPlanItem,
    executions: readonly E[],
  ): PmOccurrences<E> {
    return new PmOccurrences(
      item.schedule(),
      executions,
      null,
      this.serviceGaps(),
    );
  }

  /**
   * The plan item, provided it can still take work — an execution, an
   * interval change, a deactivation: the equipment in service and the item not
   * deactivated.
   */
  public activePlanItem(planItemId: Identity): ReadonlyPmPlanItem {
    return this.planItemOpenForWork(planItemId);
  }

  /** A plan item of this equipment, active or not, retired equipment's too. */
  public planItem(planItemId: Identity): ReadonlyPmPlanItem {
    return this.planItemWithId(planItemId);
  }

  public name(): EquipmentName {
    return this._name;
  }

  /** When it was retired, while it is; `null` in service. */
  public retiredAt(): Date | null {
    return this.openServiceBreak()?.retiredAt() ?? null;
  }

  public isRetired(): boolean {
    return this.openServiceBreak() !== null;
  }

  /** Every retirement and the reactivation that ended it, oldest first. */
  public serviceBreaks(): readonly ServiceBreak[] {
    return this._serviceBreaks;
  }

  /** The days it was out of service between a retirement and a reactivation, oldest first. */
  public serviceGaps(): ServiceGap[] {
    return this.gaps().filter((gap) => !gap.isOpen());
  }

  /** Every item ever added, deactivated ones included, in the order they were added. */
  public planItems(): readonly ReadonlyPmPlanItem[] {
    return [...this._planItems];
  }

  /**
   * The last day `item` was in force, or `null` while it still is: the
   * Tehran date it was deactivated or this equipment retired, whichever came
   * first. Its occurrences run up to and including that day, none after
   * (unless done anyway, inside a service gap).
   */
  public stopDateOf(item: ReadonlyPmPlanItem): CalendarDate | null {
    const deactivatedAt = item.deactivatedAt();
    const retiredAt = this.retiredAt();
    const stops = [
      deactivatedAt ? CalendarDate.inTehranOf(deactivatedAt) : null,
      retiredAt ? CalendarDate.inTehranOf(retiredAt) : null,
    ].filter((day): day is CalendarDate => day !== null);
    return stops.toSorted((left, right) => right.daysUntil(left))[0] ?? null;
  }

  /**
   * Whether `item` still takes work — an execution, an interval change, a
   * deactivation: this equipment in service and the item not deactivated.
   */
  public isInForce(item: ReadonlyPmPlanItem): boolean {
    return !this.isRetired() && !item.isDeactivated();
  }

  /**
   * Whether it has a PM plan: at least one item not deactivated, even one
   * first due ahead.
   */
  public hasPmPlan(): boolean {
    return this.activePlanItems().length > 0;
  }

  /** The items not deactivated, in the order they were added. */
  public activePlanItems(): readonly ReadonlyPmPlanItem[] {
    return this._planItems.filter((item) => !item.isDeactivated());
  }

  /** The deactivated ("inactive") items, in the order they were added. They never take work again. */
  public inactivePlanItems(): readonly DeactivatedPmPlanItem[] {
    return this._planItems.filter((item) => item.isDeactivated());
  }

  private restartsOf(
    rescheduled: readonly RescheduledPlanItem[],
    today: CalendarDate,
  ): { item: PmPlanItem; firstDueDate: CalendarDate }[] {
    const seen = new Set<string>();
    return rescheduled.map(({ planItemId, firstDueDate }) => {
      const item = this._planItems.find((candidate) =>
        candidate.id.equals(planItemId),
      );
      if (!item || item.isDeactivated() || seen.has(planItemId.asString())) {
        throw InvalidReactivationItem.withId(planItemId.asString());
      }
      seen.add(planItemId.asString());
      if (firstDueDate.isBefore(today)) {
        throw ReactivationFirstDueDateInPast.of(
          planItemId.asString(),
          firstDueDate.asString(),
          today.asString(),
        );
      }
      return { item, firstDueDate };
    });
  }

  /** Every stretch out of service, oldest first — the last still open while retired. */
  private gaps(): ServiceGap[] {
    return this._serviceBreaks.flatMap((serviceBreak) => {
      const gap = serviceBreak.gap();
      return gap ? [gap] : [];
    });
  }

  private openServiceBreak(): ServiceBreak | null {
    const last = this._serviceBreaks.at(-1);
    return last?.isOpen() ? last : null;
  }

  private planItemWithId(planItemId: Identity): PmPlanItem {
    const item = this._planItems.find((candidate) =>
      candidate.id.equals(planItemId),
    );
    if (!item) {
      throw EntityNotFound.withId(planItemId);
    }
    return item;
  }

  private planItemOpenForWork(planItemId: Identity): PmPlanItem {
    const item = this.planItemWithId(planItemId);
    if (!this.isInForce(item)) {
      this.assertInService();
      throw PmPlanItemIsDeactivated.withId(planItemId.asString());
    }
    return item;
  }

  private assertInService(): void {
    if (this.isRetired()) {
      throw EquipmentIsRetired.withId(this.id.asString());
    }
  }
}
