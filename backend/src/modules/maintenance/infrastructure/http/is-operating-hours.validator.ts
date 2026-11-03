import { OperatingHours } from '@maintenance/domain/value/operating-hours.vo';
import { registerDecorator, ValidationOptions } from 'class-validator';

/**
 * A number `OperatingHours.of` accepts — the value object's own rule (0 to
 * `MAX_OPERATING_HOURS`, at most two decimals), so whatever passes here
 * cannot throw in the controller as a 500. Asked of the value object rather
 * than of `@IsNumber({ maxDecimalPlaces })`, which reads decimals from the
 * number's text and throws on one written with an exponent (`1e-7`).
 */
export function IsOperatingHours(
  options?: ValidationOptions,
): PropertyDecorator {
  return (target: object, propertyName: string | symbol) => {
    const property = propertyName.toString();
    registerDecorator({
      name: 'isOperatingHours',
      target: target.constructor,
      propertyName: property,
      options: {
        message: `${property} must be a number from 0 to 1000000 with at most two decimals`,
        ...options,
      },
      validator: {
        validate(value: unknown): boolean {
          if (typeof value !== 'number') return false;
          try {
            OperatingHours.of(value);
          } catch {
            return false;
          }
          return true;
        },
      },
    });
  };
}
