import { IsCalendarDate } from '@maintenance/infrastructure/http/is-calendar-date.validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { ValidateIf } from 'class-validator';

/** The years a bound may fall in — `firstDueDate`'s window. */
const RANGE_YEARS = { from: 2000, to: 2100 };

/** Both bounds are checked as soon as either is given. */
function eitherBoundGiven(dto: MaintenanceHistoryQueryDto): boolean {
  return dto.from !== undefined || dto.to !== undefined;
}

/**
 * An equipment's PM history range (issue #114): both bounds or neither,
 * inclusive. A job is in it by its Tehran performed day, a missed occurrence
 * by its due date. One bound alone or a malformed date is a 400
 * `validation-error` here; a start after the end is refused by
 * `CalendarDateRange` itself, whose `DateRangeStartsAfterEnd` the module's
 * exception mapper turns into the same 400 `validation-error`. Unlike the PM
 * schedule's range, whose bounds are required and refused by its handler.
 */
export class MaintenanceHistoryQueryDto {
  @ValidateIf(eitherBoundGiven)
  @IsCalendarDate(RANGE_YEARS)
  @ApiPropertyOptional({
    example: '2026-10-23',
    description:
      'ISO date, inclusive, years 2000–2100; given together with `to`, not after it. Otherwise → 400 validation-error',
  })
  from?: string;

  @ValidateIf(eitherBoundGiven)
  @IsCalendarDate(RANGE_YEARS)
  @ApiPropertyOptional({
    example: '2026-11-21',
    description:
      'ISO date, inclusive, years 2000–2100; given together with `from`. Otherwise → 400 validation-error',
  })
  to?: string;
}
