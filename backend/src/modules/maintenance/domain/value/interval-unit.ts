/**
 * What a PM interval is counted in. The plan's structure allows both
 * (issue #69), but only calendar days can be planned yet:
 * `IntervalDays.fromInterval` refuses operating hours.
 */
export enum IntervalUnit {
  Days = 'days',
  OperatingHours = 'operating_hours',
}
