import { signal } from '@angular/core';

import { QcActivityToRecord } from '../../core/qc/qc-inspections-gateway';

/**
 * One equipment's checklist on `/qc-inspection` (issue #132): which of its activities are ticked,
 * and the notes written beside each ticked one. Unticking drops the notes with the tick.
 */
export class QcChecklist {
  /** Ticked activity id → its notes. */
  private readonly ticks = signal<ReadonlyMap<string, string>>(new Map());

  isTicked(activityId: string): boolean {
    return this.ticks().has(activityId);
  }

  notesOf(activityId: string): string {
    return this.ticks().get(activityId) ?? '';
  }

  tick(activityId: string, ticked: boolean): void {
    this.ticks.update((ticks) => {
      const next = new Map(ticks);
      if (ticked) {
        next.set(activityId, ticks.get(activityId) ?? '');
      } else {
        next.delete(activityId);
      }
      return next;
    });
  }

  /** Only a ticked activity has notes; writing beside an unticked one changes nothing. */
  writeNotes(activityId: string, notes: string): void {
    if (!this.isTicked(activityId)) {
      return;
    }
    this.ticks.update((ticks) => new Map(ticks).set(activityId, notes));
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
    this.ticks.update((ticks) => {
      const next = new Map(ticks);
      activityIds.forEach((activityId) => next.delete(activityId));
      return next;
    });
  }
}
