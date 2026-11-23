import { signal } from '@angular/core';

import { QcActivityToRecord } from '../../core/qc/qc-inspections-gateway';

/** A submission's identity: the id the API deduplicates on, and the tracking number it was sent with. */
export interface QcPendingSubmission {
  readonly submissionId: string;
  readonly trackingNumber: string;
}

interface HeldSubmission extends QcPendingSubmission {
  /** The ticked activities and notes it was sent for. */
  readonly activities: readonly QcActivityToRecord[];
}

/**
 * One equipment's checklist on `/qc-inspection` (issue #132): which of its activities are ticked,
 * and the notes written beside each ticked one. Unticking drops the notes with the tick.
 *
 * It also holds a **pending submission** — one sent whose answer never came, so some of its
 * activities may be recorded already. While the same activities stay ticked with the same notes,
 * `pendingSubmission` offers it again, so sending them again reuses its id and the API records
 * nothing twice. Any change to the ticks or notes drops it: what is sent next is a new submission.
 */
export class QcChecklist {
  /** Ticked activity id → its notes. */
  private readonly ticks = signal<ReadonlyMap<string, string>>(new Map());
  private readonly held = signal<HeldSubmission | undefined>(undefined);

  isTicked(activityId: string): boolean {
    return this.ticks().has(activityId);
  }

  notesOf(activityId: string): string {
    return this.ticks().get(activityId) ?? '';
  }

  tick(activityId: string, ticked: boolean): void {
    if (this.isTicked(activityId) === ticked) {
      return;
    }
    this.ticks.update((ticks) => {
      const next = new Map(ticks);
      if (ticked) {
        next.set(activityId, '');
      } else {
        next.delete(activityId);
      }
      return next;
    });
    this.release();
  }

  /** Only a ticked activity has notes; writing beside an unticked one changes nothing. */
  writeNotes(activityId: string, notes: string): void {
    if (!this.isTicked(activityId) || this.notesOf(activityId) === notes) {
      return;
    }
    this.ticks.update((ticks) => new Map(ticks).set(activityId, notes));
    this.release();
  }

  /** The ticked activities among those `offered` now, in their order — one no longer offered is left out. */
  tickedAmong(offered: readonly string[]): QcActivityToRecord[] {
    const ticks = this.ticks();
    return offered
      .filter((activityId) => ticks.has(activityId))
      .map((activityId) => ({ activityId, notes: ticks.get(activityId) ?? '' }));
  }

  /** Unticks the given activities and forgets their notes — the ones a submission recorded. */
  clear(activityIds: readonly string[]): void {
    const ticked = activityIds.filter((activityId) => this.isTicked(activityId));
    if (ticked.length === 0) {
      return;
    }
    this.ticks.update((ticks) => {
      const next = new Map(ticks);
      ticked.forEach((activityId) => next.delete(activityId));
      return next;
    });
    this.release();
  }

  /** Keeps a submission sent for the activities ticked among `offered` now, its answer unknown. */
  hold(submission: QcPendingSubmission, offered: readonly string[]): void {
    this.held.set({
      submissionId: submission.submissionId,
      trackingNumber: submission.trackingNumber,
      activities: this.tickedAmong(offered),
    });
  }

  /** Every activity of it got an answer (or nothing was recorded): the next sending is new. */
  release(): void {
    this.held.set(undefined);
  }

  /** The pending submission, if it was sent for exactly what is ticked among `offered` now. */
  pendingSubmission(offered: readonly string[]): QcPendingSubmission | undefined {
    const held = this.held();
    if (held === undefined || !sameActivities(held.activities, this.tickedAmong(offered))) {
      return undefined;
    }
    return { submissionId: held.submissionId, trackingNumber: held.trackingNumber };
  }
}

function sameActivities(
  a: readonly QcActivityToRecord[],
  b: readonly QcActivityToRecord[],
): boolean {
  return (
    a.length === b.length &&
    a.every(
      (each, index) => each.activityId === b[index].activityId && each.notes === b[index].notes,
    )
  );
}
