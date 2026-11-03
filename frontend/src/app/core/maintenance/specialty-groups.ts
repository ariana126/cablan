import { ActivitySpecialty, specialtyLabel } from '../i18n/specialty-labels';

/** The order every grouped view lists specialties in; activities without one come last. */
const GROUP_ORDER: readonly (ActivitySpecialty | null)[] = ['electrical', 'mechanical', null];

/** Items of one specialty, under the words that head them («برق», «مکانیک», «تخصص تعیین نشده»). */
export interface SpecialtyGroup<T> {
  readonly specialty: ActivitySpecialty | null;
  readonly label: string;
  readonly items: readonly T[];
}

/**
 * Splits items by their activity's specialty — electrical, mechanical, then the unassigned — keeping
 * the order they came in inside each group, and leaving out a group with nothing in it.
 */
export const groupBySpecialty = <T>(
  items: readonly T[],
  specialtyOf: (item: T) => ActivitySpecialty | null,
): SpecialtyGroup<T>[] =>
  GROUP_ORDER.map((specialty) => ({
    specialty,
    label: specialtyLabel(specialty),
    items: items.filter((item) => specialtyOf(item) === specialty),
  })).filter((group) => group.items.length > 0);

/** The wire's specialty, or `null` for none — anything the contract does not name counts as none. */
export const toActivitySpecialty = (value: unknown): ActivitySpecialty | null =>
  value === 'electrical' || value === 'mechanical' ? value : null;
