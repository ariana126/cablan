import { ApplicationException } from '@framework/application';
import { Username } from '@identity/domain/value/username.vo';

export class UsernameAlreadyExists extends ApplicationException {
  private constructor(
    message: string,
    public readonly username: Username,
  ) {
    super(message);
  }

  public static withUsername(username: Username): UsernameAlreadyExists {
    return new UsernameAlreadyExists(
      `A user already exists with username ${username.asString()}`,
      username,
    );
  }
}
