import { AggregateRoot, Identity } from '@framework/domain';

import { MaintenanceExecutionDeleted } from './events/maintenance-execution-deleted.event';
import { MaintenanceExecutionRecorded } from './events/maintenance-execution-recorded.event';
import { ExecutedOccurrence } from './pm-occurrences';
import { CalendarDate } from './value/calendar-date.vo';
import { OperatingHours } from './value/operating-hours.vo';
import { PmOccurrenceStatus } from './value/pm-occurrence-status';

/** Who did the job: the signed-in user and their display name at the time. */
export interface Performer {
  readonly id: Identity;
  readonly name: string;
}

/** What the performer reports with a job, beyond having done it — both optional. */
export interface ExecutionReport {
  readonly notes: string | null;
  /** The equipment's operating hours since the activity was last done on it. */
  readonly operatingHours: OperatingHours | null;
}

export interface MaintenanceExecutionProps extends ExecutionReport {
  readonly equipmentId: Identity;
  readonly equipmentName: string;
  readonly planItemId: Identity;
  readonly activityId: Identity;
  readonly activityName: string;
  /** The occurrence it was recorded for. */
  readonly dueDate: CalendarDate;
  readonly performedAt: Date;
  readonly performedById: Identity;
  readonly performedByName: string;
}

/**
 * That a PM job was done: which occurrence, when, by whom. It is the
 * maintenance history, so it never refers back to the schedule for its
 * meaning — the activity's and the performer's names are snapshots, and on
 * time / late comes from its own due date and the Tehran date it was
 * performed on. A later plan change never rewrites it.
 */
export class MaintenanceExecution
  extends AggregateRoot
  implements ExecutedOccurrence
{
  private constructor(
    id: Identity,
    private readonly props: MaintenanceExecutionProps,
  ) {
    super(id);
  }

  public static record(props: MaintenanceExecutionProps): MaintenanceExecution {
    const notes = props.notes?.trim() || null;
    const execution = new MaintenanceExecution(Identity.new(), {
      ...props,
      notes,
    });
    execution.recordThat(
      new MaintenanceExecutionRecorded(
        execution.id.asString(),
        props.equipmentId.asString(),
        props.equipmentName,
        props.planItemId.asString(),
        props.activityName,
        props.dueDate.asString(),
        props.performedAt,
        props.performedByName,
        notes,
        props.operatingHours?.asNumber() ?? null,
      ),
    );
    return execution;
  }

  /** Rehydrates from storage; records no event. */
  public static fromPersistence(
    id: Identity,
    props: MaintenanceExecutionProps,
  ): MaintenanceExecution {
    return new MaintenanceExecution(id, props);
  }

  /**
   * The System Admin deletes this row of the history (issue #110); the
   * repository's `delete()` then removes it. Nothing else changes: the
   * occurrence it covered simply has no execution again.
   */
  public delete(): void {
    this.recordThat(
      new MaintenanceExecutionDeleted(
        this.id.asString(),
        this.props.equipmentId.asString(),
        this.props.equipmentName,
        this.props.planItemId.asString(),
        this.props.activityName,
        this.props.dueDate.asString(),
        this.props.performedByName,
      ),
    );
  }

  public equipmentId(): Identity {
    return this.props.equipmentId;
  }

  public equipmentName(): string {
    return this.props.equipmentName;
  }

  public planItemId(): Identity {
    return this.props.planItemId;
  }

  public activityId(): Identity {
    return this.props.activityId;
  }

  public activityName(): string {
    return this.props.activityName;
  }

  public dueDate(): CalendarDate {
    return this.props.dueDate;
  }

  public performedAt(): Date {
    return this.props.performedAt;
  }

  public performedOn(): CalendarDate {
    return CalendarDate.inTehranOf(this.props.performedAt);
  }

  public performedById(): Identity {
    return this.props.performedById;
  }

  public performedByName(): string {
    return this.props.performedByName;
  }

  public notes(): string | null {
    return this.props.notes;
  }

  /** Reported by the performer, or `null` when they gave none. */
  public operatingHours(): OperatingHours | null {
    return this.props.operatingHours;
  }

  public status(): PmOccurrenceStatus.OnTime | PmOccurrenceStatus.Late {
    return this.performedOn().isAfter(this.props.dueDate)
      ? PmOccurrenceStatus.Late
      : PmOccurrenceStatus.OnTime;
  }

  /**
   * How many whole Tehran days after its due date it was performed, or
   * `null` when it was on time.
   */
  public daysLate(): number | null {
    return this.status() === PmOccurrenceStatus.Late
      ? this.props.dueDate.daysUntil(this.performedOn())
      : null;
  }
}
