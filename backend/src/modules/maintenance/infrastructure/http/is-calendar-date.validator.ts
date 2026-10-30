import { CalendarDate } from '@maintenance/domain/value/calendar-date.vo';
import { registerDecorator, ValidationOptions } from 'class-validator';

/** The years a date field accepts, both inclusive. */
export interface CalendarYears {
  readonly from: number;
  readonly to: number;
}

/**
 * An ISO `YYYY-MM-DD` date that exists — `2026-02-30` and `2026-7-1` are
 * refused here, as a 400, rather than reaching `CalendarDate.fromString` and
 * surfacing as a 500. The rule is the value object's own; `years`, when
 * given, narrows it to a plausible range for the field.
 */
export function IsCalendarDate(
  years?: CalendarYears,
  options?: ValidationOptions,
): PropertyDecorator {
  return (target: object, propertyName: string | symbol) => {
    const property = propertyName.toString();
    registerDecorator({
      name: 'isCalendarDate',
      target: target.constructor,
      propertyName: property,
      options: {
        message: years
          ? `${property} must be an existing date as YYYY-MM-DD, in years ${years.from}–${years.to}`
          : `${property} must be an existing date as YYYY-MM-DD`,
        ...options,
      },
      validator: {
        validate(value: unknown): boolean {
          if (typeof value !== 'string') return false;
          try {
            CalendarDate.fromString(value);
          } catch {
            return false;
          }
          const year = Number(value.slice(0, 4));
          return !years || (year >= years.from && year <= years.to);
        },
      },
    });
  };
}
