import { CalendarDate } from '@maintenance/domain/value/calendar-date.vo';
import { registerDecorator, ValidationOptions } from 'class-validator';

/**
 * An ISO `YYYY-MM-DD` date that exists — `2026-02-30` and `2026-7-1` are
 * refused here, as a 400, rather than reaching `CalendarDate.fromString` and
 * surfacing as a 500. The rule is the value object's own.
 */
export function IsCalendarDate(options?: ValidationOptions): PropertyDecorator {
  return (target: object, propertyName: string | symbol) => {
    registerDecorator({
      name: 'isCalendarDate',
      target: target.constructor,
      propertyName: propertyName.toString(),
      options: {
        message: `${propertyName.toString()} must be an existing date as YYYY-MM-DD`,
        ...options,
      },
      validator: {
        validate(value: unknown): boolean {
          if (typeof value !== 'string') return false;
          try {
            CalendarDate.fromString(value);
            return true;
          } catch {
            return false;
          }
        },
      },
    });
  };
}
