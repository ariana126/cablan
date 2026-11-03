import { SpecialtyAssignment } from '@maintenance/domain/service/missing-specialties';

/**
 * The System Admin's one-time completion of the catalog: a specialty for
 * every activity without one («تخصص تعیین نشده»), all at once (the role is
 * checked by the route). It must name exactly those activities.
 */
export class CompleteMissingSpecialtiesCommand {
  constructor(public readonly assignments: readonly SpecialtyAssignment[]) {}
}
