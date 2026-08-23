import { ApplicationException } from '@framework/application';

// Deliberately carries no detail about *why* — a wrong password, an unknown
// username, and a deleted user's credentials must all collapse to the exact
// same message, per the login feature's rules.
export class InvalidCredentials extends ApplicationException {
  public static provided(): InvalidCredentials {
    return new InvalidCredentials('Invalid username or password provided.');
  }
}
