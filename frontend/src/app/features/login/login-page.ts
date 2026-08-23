import { ChangeDetectionStrategy, Component, inject, input, signal } from '@angular/core';
import { MatButton } from '@angular/material/button';
import { MatError, MatFormField, MatLabel } from '@angular/material/form-field';
import { MatInput } from '@angular/material/input';
import { MatProgressSpinner } from '@angular/material/progress-spinner';
import { form, FormField, required, submit } from '@angular/forms/signals';
import { Router } from '@angular/router';
import { firstValueFrom } from 'rxjs';

import { AuthGateway } from '../../core/identity/auth-gateway';
import { LoginFormModel, mapLoginError } from './server-errors';

@Component({
  selector: 'app-login-page',
  imports: [FormField, MatButton, MatError, MatFormField, MatInput, MatLabel, MatProgressSpinner],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="page stack">
      <h1>ورود به کاب‌لن</h1>

      <form novalidate class="stack" (submit)="onSubmit(); $event.preventDefault()">
        @if (loginForm().errors().length) {
          <p class="form-error" role="alert">{{ loginForm().errors()[0].message }}</p>
        }

        <mat-form-field appearance="outline">
          <mat-label>نام کاربری</mat-label>
          <input matInput [formField]="loginForm.username" autocomplete="username" />
          @if (loginForm.username().touched() && loginForm.username().errors().length) {
            <mat-error>{{ loginForm.username().errors()[0].message }}</mat-error>
          }
        </mat-form-field>

        <mat-form-field appearance="outline">
          <mat-label>رمز عبور</mat-label>
          <input
            matInput
            type="password"
            [formField]="loginForm.password"
            autocomplete="current-password"
          />
          @if (loginForm.password().touched() && loginForm.password().errors().length) {
            <mat-error>{{ loginForm.password().errors()[0].message }}</mat-error>
          }
        </mat-form-field>

        <button matButton="filled" type="submit" [disabled]="loginForm().submitting()">
          @if (loginForm().submitting()) {
            <mat-progress-spinner diameter="20" mode="indeterminate" aria-label="در حال ورود" />
          } @else {
            ورود
          }
        </button>
      </form>
    </div>
  `,
  styleUrl: './login-page.scss',
})
export class LoginPage {
  private readonly authGateway = inject(AuthGateway);
  private readonly router = inject(Router);

  /**
   * Bound from the `returnUrl` query param via `withComponentInputBinding()` — see `app.config.ts`.
   *
   * The default given to `input()` only covers a *missing* input declaration; the router's
   * component-input binding still overwrites it with `undefined` when the query param itself is
   * absent, so the fallback is applied again where it is actually used, in `onSubmit`.
   */
  readonly returnUrl = input<string | undefined>(undefined);

  // The password never outlives the request it is sent on: `onSubmit` reads it once, from this
  // model, and clears it again before the request has even resolved — see below.
  private readonly model = signal<LoginFormModel>({ username: '', password: '' });

  protected readonly loginForm = form(this.model, (path) => {
    required(path.username, { message: 'نام کاربری را وارد کنید.' });
    required(path.password, { message: 'رمز عبور را وارد کنید.' });
  });

  /**
   * Returns the pending submission rather than firing it off unobserved — the template ignores the
   * result, same as any other event binding, but a spec can await exactly the work a real submit
   * does instead of guessing how many microtask turns zoneless stabilisation needs.
   */
  protected onSubmit(): Promise<boolean> {
    return submit(this.loginForm, async () => {
      const { username, password } = this.model();
      // Clear it from reactive state immediately after capturing it for the one request that
      // needs it — nothing else in this app ever reads a password back out of a signal.
      this.model.update((current) => ({ ...current, password: '' }));

      try {
        await firstValueFrom(this.authGateway.login(username, password));
        await this.router.navigateByUrl(this.returnUrl() ?? '/users');
        return undefined;
      } catch (error) {
        return mapLoginError(error, this.loginForm);
      }
    });
  }
}
