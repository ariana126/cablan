import { Entity, Identity } from '@framework/domain';

import { CalendarDate } from './value/calendar-date.vo';
import { IntervalDays } from './value/interval-days.vo';
import { PmSchedule } from './value/pm-schedule.vo';

/**
 * A plan item as anyone outside `Equipment` sees it: no way to change it.
 * Every change goes through the aggregate root.
 */
export interface ReadonlyPmPlanItem {
  readonly id: Identity;
  activityId(): Identity;
  activityName(): string;
  schedule(): PmSchedule;
  removedAt(): Date | null;
  isRemoved(): boolean;
}

/**
 * One activity in an equipment's PM plan, and when it falls due. Owned by
 * `Equipment`: only the aggregate changes it, so "one active item per
 * activity" holds within one aggregate.
 *
 * `activityName` is the activity's name when the item was added — a snapshot
 * for the audit trail's lines only. Read models show the activity's current
 * name.
 */
export class PmPlanItem extends Entity implements ReadonlyPmPlanItem {
  private constructor(
    id: Identity,
    private readonly _activityId: Identity,
    private readonly _activityName: string,
    private _schedule: PmSchedule,
    private _removedAt: Date | null,
  ) {
    super(id);
  }

  /** For `Equipment.addPlanItem()` only. */
  static add(
    activityId: Identity,
    activityName: string,
    schedule: PmSchedule,
  ): PmPlanItem {
    return new PmPlanItem(
      Identity.new(),
      activityId,
      activityName,
      schedule,
      null,
    );
  }

  static fromPersistence(
    id: Identity,
    activityId: Identity,
    activityName: string,
    schedule: PmSchedule,
    removedAt: Date | null,
  ): PmPlanItem {
    return new PmPlanItem(id, activityId, activityName, schedule, removedAt);
  }

  activityId(): Identity {
    return this._activityId;
  }

  activityName(): string {
    return this._activityName;
  }

  schedule(): PmSchedule {
    return this._schedule;
  }

  removedAt(): Date | null {
    return this._removedAt;
  }

  isRemoved(): boolean {
    return this._removedAt !== null;
  }

  /** For `Equipment` only. */
  changeIntervalFrom(
    startDueDate: CalendarDate,
    intervalDays: IntervalDays,
  ): void {
    this._schedule = this._schedule.withIntervalChangedFrom(
      startDueDate,
      intervalDays,
    );
  }

  /** For `Equipment` only. */
  removeAt(now: Date): void {
    this._removedAt = now;
  }
}
