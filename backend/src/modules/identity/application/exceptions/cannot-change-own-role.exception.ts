import { ApplicationException } from '@framework/application';
import { Identity } from '@framework/domain';

export class CannotChangeOwnRole extends ApplicationException {
  private constructor(
    message: string,
    public readonly userId: Identity,
  ) {
    super(message);
  }

  public static attempted(userId: Identity): CannotChangeOwnRole {
    return new CannotChangeOwnRole(
      `User ${userId.asString()} cannot change their own role`,
      userId,
    );
  }
}
