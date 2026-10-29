import { Clock } from '@framework/domain';

/** A clock held at one instant, movable by the spec. */
export class FixedClock extends Clock {
  constructor(private instant: Date) {
    super();
  }

  now(): Date {
    return this.instant;
  }

  set(instant: Date): void {
    this.instant = instant;
  }
}

/**
 * An instant on a Tehran calendar date — 09:00 Tehran (05:30 UTC), safely
 * inside the day whatever the arithmetic.
 */
export function tehranMorningOf(isoDate: string): Date {
  return new Date(`${isoDate}T05:30:00.000Z`);
}
