import { EntityRepository } from '@framework/domain';

import { User } from '../user.aggregate';
import { Username } from '../value/username.vo';

export abstract class UserRepository extends EntityRepository<User> {
  /**
   * Excludes soft-deleted users: a deleted user's username is free to reuse,
   * and this is also what `LoginHandler` uses to look a user up, so a
   * deleted account is indistinguishable from one that never existed.
   */
  abstract findByUsername(username: Username): Promise<User | null>;

  /**
   * Excludes soft-deleted users. Backs `ListUsers` directly from the write
   * model — acceptable at this module's current size; revisit if filtering
   * or pagination is ever needed.
   */
  abstract list(): Promise<User[]>;
}
