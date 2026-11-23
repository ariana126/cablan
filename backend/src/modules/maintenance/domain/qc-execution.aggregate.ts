import { AggregateRoot, Identity } from '@framework/domain';

import { QcExecutionDeleted } from './events/qc-execution-deleted.event';
import { QcExecutionRecorded } from './events/qc-execution-recorded.event';
import { QcTrackingNumber } from './value/qc-tracking-number.vo';

/**
 * What the inspector reports with a QC record: the tracking number, notes if
 * any, and the submission it was sent in — `null` for a record made on its
 * own (the single-activity route, and every record before issue #132).
 */
export interface QcExecutionReport {
  readonly trackingNumber: QcTrackingNumber;
  readonly notes: string | null;
  /**
   * The client's id for one «ثبت انجام» of several activities, reused when
   * it is sent again: at most one record per activity of a submission.
   */
  readonly submissionId: Identity | null;
}

/** What one sending of a submission (issue #132) shares across its activities. */
export interface QcSubmissionSending {
  readonly equipmentId: Identity;
  readonly performedById: Identity;
  readonly trackingNumber: QcTrackingNumber;
}

export interface QcExecutionProps extends QcExecutionReport {
  readonly equipmentId: Identity;
  readonly activityId: Identity;
  readonly performedById: Identity;
  /** The performer's display name when recorded — a snapshot. */
  readonly performedByName: string;
  readonly performedAt: Date;
}

/**
 * The names of a record's equipment and activity as they stand, for its
 * events' audit lines. The record itself keeps no copy: every read shows
 * the current names.
 */
export interface QcExecutionSubject {
  readonly equipmentName: string;
  readonly activityName: string;
}

/**
 * That a QC activity was done on a piece of equipment («ثبت انجام», issue
 * #119): when — the clock's now —, by whom, for which tracking number, with
 * optional notes. Recorded only through `Equipment.recordQcExecutionOf()`,
 * which decides whether the equipment takes it. It names its equipment and
 * activity by id; only the performer's name is a snapshot. Its interval
 * since the previous record of the same pair is computed on read.
 */
export class QcExecution extends AggregateRoot {
  private constructor(
    id: Identity,
    private readonly props: QcExecutionProps,
  ) {
    super(id);
  }

  /** Notes are trimmed, blank ones kept as none. */
  public static record(
    props: QcExecutionProps,
    subject: QcExecutionSubject,
  ): QcExecution {
    const notes = props.notes?.trim() || null;
    const execution = new QcExecution(Identity.new(), { ...props, notes });
    execution.recordThat(
      new QcExecutionRecorded(
        execution.id.asString(),
        props.equipmentId.asString(),
        subject.equipmentName,
        props.activityId.asString(),
        subject.activityName,
        props.performedAt,
        props.performedByName,
        props.trackingNumber.asString(),
        notes,
      ),
    );
    return execution;
  }

  /** Rehydrates from storage; records no event. */
  public static fromPersistence(
    id: Identity,
    props: QcExecutionProps,
  ): QcExecution {
    return new QcExecution(id, props);
  }

  /**
   * The System Admin deletes this record, or the retired equipment it was
   * made on; the repository's `delete()` then removes it. Nothing else
   * changes: the intervals and counts simply follow the records left.
   */
  public delete(subject: QcExecutionSubject): void {
    this.recordThat(
      new QcExecutionDeleted(
        this.id.asString(),
        this.props.equipmentId.asString(),
        subject.equipmentName,
        this.props.activityId.asString(),
        subject.activityName,
        this.props.performedAt,
        this.props.performedByName,
        this.props.trackingNumber.asString(),
      ),
    );
  }

  public equipmentId(): Identity {
    return this.props.equipmentId;
  }

  public activityId(): Identity {
    return this.props.activityId;
  }

  public performedById(): Identity {
    return this.props.performedById;
  }

  public performedByName(): string {
    return this.props.performedByName;
  }

  public performedAt(): Date {
    return this.props.performedAt;
  }

  public trackingNumber(): QcTrackingNumber {
    return this.props.trackingNumber;
  }

  public notes(): string | null {
    return this.props.notes;
  }

  public submissionId(): Identity | null {
    return this.props.submissionId;
  }

  /**
   * Whether a sending of its submission (issue #132) says what it was
   * recorded with — the same equipment, inspector and tracking number. A
   * resend that does not is not the same submission.
   */
  public wasSentAs(sending: QcSubmissionSending): boolean {
    return (
      this.props.equipmentId.equals(sending.equipmentId) &&
      this.props.performedById.equals(sending.performedById) &&
      this.props.trackingNumber.equals(sending.trackingNumber)
    );
  }
}
