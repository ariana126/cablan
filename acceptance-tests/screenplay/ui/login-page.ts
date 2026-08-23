import { By, PageElement } from '@serenity-js/web';

/**
 * Lean Page Object for `/login` (`frontend/src/app/features/login/login-page.ts`). Locates
 * elements and reports what they say — nothing else; the behaviour that uses them lives in
 * `screenplay/common/login.ts` and `screenplay/authentication/logging-in.ts`.
 *
 * Fields are anchored on the `<mat-form-field>` wrapper Angular Material renders around every
 * labelled input, rather than `By.role('textbox', { name: … })`: HTML's accessibility mapping
 * gives `<input type="password">` no implicit ARIA role, so a role-based lookup would only ever
 * find the username field, not the password one next to it.
 */
export const LoginPage = {
  usernameField: () =>
    PageElement.located(
      By.xpath(
        '//mat-form-field[.//mat-label[normalize-space(text())="نام کاربری"]]//input',
      ),
    ).describedAs('username field'),

  passwordField: () =>
    PageElement.located(
      By.xpath(
        '//mat-form-field[.//mat-label[normalize-space(text())="رمز عبور"]]//input',
      ),
    ).describedAs('password field'),

  submitButton: () =>
    PageElement.located(
      By.role('button', { name: 'ورود', exact: true }),
    ).describedAs('submit button'),

  /** The `role="alert"` element the login page renders its one, root-level error in. */
  errorMessage: () =>
    PageElement.located(By.role('alert')).describedAs('login error message'),
};
