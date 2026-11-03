import { ValueObject } from '@framework/domain';

/**
 * The specialties a maintenance activity can belong to: electrical («برق»)
 * or mechanical («مکانیک»). The values cross HTTP as they are, so a request
 * DTO validates against this list before `fromString` is reached.
 */
export const ACTIVITY_SPECIALTIES = ['electrical', 'mechanical'] as const;

export type ActivitySpecialtyValue = (typeof ACTIVITY_SPECIALTIES)[number];

/**
 * Which trade a maintenance activity belongs to — exactly one. It groups and
 * filters PM work wherever that work appears (issue #108).
 */
export class ActivitySpecialty extends ValueObject {
  private constructor(private readonly value: ActivitySpecialtyValue) {
    super();
  }

  static electrical(): ActivitySpecialty {
    return new ActivitySpecialty('electrical');
  }

  static mechanical(): ActivitySpecialty {
    return new ActivitySpecialty('mechanical');
  }

  static fromString(value: string): ActivitySpecialty {
    const specialty = ACTIVITY_SPECIALTIES.find(
      (candidate) => candidate === value,
    );
    if (!specialty) {
      throw new Error(`Not a maintenance activity specialty: ${value}`);
    }
    return new ActivitySpecialty(specialty);
  }

  asString(): ActivitySpecialtyValue {
    return this.value;
  }

  toString(): string {
    return this.value;
  }
}
