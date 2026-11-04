import { ApplyToRelatedRecords } from '@framework/application';
import { UserRoleProvider } from '@framework/domain';
import { Injectable } from '@nestjs/common';

import { AuthenticatedUser } from '../http/decorators/authenticated-user';

/**
 * Turns an edit route's `applyToRelatedRecords` into the application's
 * `ApplyToRelatedRecords` (issue #110). The caller's role is looked up per
 * request, like `RolesGuard` does — never read from the token — and only
 * when they asked, so an ordinary edit costs no extra query. Provided and
 * exported by `RecordDependenciesModule`; `UserRoleProvider` comes from
 * `identity`'s global module.
 */
@Injectable()
export class ApplyToRelatedRecordsResolver {
  constructor(private readonly userRoleProvider: UserRoleProvider) {}

  async askedBy(
    user: AuthenticatedUser,
    applyToRelatedRecords: boolean | undefined,
  ): Promise<ApplyToRelatedRecords> {
    if (applyToRelatedRecords !== true) {
      return ApplyToRelatedRecords.notAsked();
    }
    return ApplyToRelatedRecords.askedBy(
      await this.userRoleProvider.getRole(user.id),
      true,
    );
  }
}
