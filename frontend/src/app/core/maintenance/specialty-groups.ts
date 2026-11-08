import { ActivitySpecialty, specialtyLabel } from '../i18n/specialty-labels';

/** An order to list specialty groups in; activities without one always come last. */
export type SpecialtyOrder = readonly [ActivitySpecialty, ActivitySpecialty, null];

/** The order grouped views list specialties in unless they say otherwise. */
export const ELECTRICAL_FIRST: SpecialtyOrder = ['electrical', 'mechanical', null];

/** The daily PM list's order (issue #112): mechanical work first, as the floor takes it. */
export const MECHANICAL_FIRST: SpecialtyOrder = ['mechanical', 'electrical', null];

/** Items of one specialty, under the words that head them («برق», «مکانیک», «تخصص تعیین نشده»). */
export interface SpecialtyGroup<T> {
  readonly specialty: ActivitySpecialty | null;
  readonly label: string;
  readonly items: readonly T[];
}

/**
 * Splits items by their activity's specialty — electrical, mechanical, then the unassigned, unless
 * `order` says otherwise — keeping the order they came in inside each group, and leaving out a
 * group with nothing in it.
 */
export const groupBySpecialty = <T>(
  items: readonly T[],
  specialtyOf: (item: T) => ActivitySpecialty | null,
  order: SpecialtyOrder = ELECTRICAL_FIRST,
): SpecialtyGroup<T>[] =>
  order
    .map((specialty) => ({
      specialty,
      label: specialtyLabel(specialty),
      items: items.filter((item) => specialtyOf(item) === specialty),
    }))
    .filter((group) => group.items.length > 0);

/** The wire's specialty, or `null` for none — anything the contract does not name counts as none. */
export const toActivitySpecialty = (value: unknown): ActivitySpecialty | null =>
  value === 'electrical' || value === 'mechanical' ? value : null;
