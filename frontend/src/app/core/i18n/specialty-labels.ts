import { ActivitySpecialty } from '../../api/model';

export { ActivitySpecialty };

/**
 * The two specialties a maintenance activity belongs to (issue #108), in the words the technical
 * unit uses — and in the order every grouped view and every choice lists them.
 */
export const SPECIALTY_LABELS: Readonly<Record<ActivitySpecialty, string>> = {
  electrical: 'برق',
  mechanical: 'مکانیک',
};

/** An activity registered before specialties existed, until the system admin assigns one. */
export const UNASSIGNED_SPECIALTY_LABEL = 'تخصص تعیین نشده';

export const specialtyLabel = (specialty: ActivitySpecialty | null): string =>
  specialty === null ? UNASSIGNED_SPECIALTY_LABEL : SPECIALTY_LABELS[specialty];
