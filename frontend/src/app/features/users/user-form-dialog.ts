import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { form, FormField, minLength, required, submit } from '@angular/forms/signals';
import { MatButton } from '@angular/material/button';
import {
  MAT_DIALOG_DATA,
  MatDialogActions,
  MatDialogClose,
  MatDialogContent,
  MatDialogRef,
  MatDialogTitle,
} from '@angular/material/dialog';
import { MatError, MatFormField, MatLabel, MatSuffix } from '@angular/material/form-field';
import { MatInput } from '@angular/material/input';
import { MatOption } from '@angular/material/core';
import { MatSelect } from '@angular/material/select';
import { firstValueFrom } from 'rxjs';

import { Role, UpdateUserDto } from '../../api/model';
import { AppUser, UsersGateway } from '../../core/users/users-gateway';
import { PasswordVisibilityToggle } from '../../ui/password-visibility-toggle/password-visibility-toggle';
import { ROLE_LABELS } from './role-labels';
import { mapUserFormError, UserFormModel } from './server-errors';

export type UserFormDialogData =
  { readonly mode: 'create' } | { readonly mode: 'edit'; readonly user: AppUser };

/** The shortest password a new account may be given. Not enforced by the API — see the schema below. */
const PASSWORD_MIN_LENGTH = 6;

const ROLE_OPTIONS: readonly Role[] = [
  Role.reporter,
  Role.qc_inspector,
  Role.management,
  Role.system_admin,
];

@Component({
  selector: 'app-user-form-dialog',
  imports: [
    FormField,
    MatButton,
    MatDialogActions,
    MatDialogClose,
    MatDialogContent,
    MatDialogTitle,
    MatError,
    MatFormField,
    MatInput,
    MatLabel,
    MatOption,
    MatSelect,
    MatSuffix,
    PasswordVisibilityToggle,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <h2 mat-dialog-title>
      @if (data.mode === 'create') {
        افزودن کاربر جدید
      } @else {
        ویرایش {{ data.user.name }}
      }
    </h2>

    <form novalidate (submit)="onSubmit(); $event.preventDefault()">
      <mat-dialog-content class="stack">
        @if (userForm().errors().length) {
          <p class="form-error" role="alert">{{ userForm().errors()[0].message }}</p>
        }

        <mat-form-field appearance="outline">
          <mat-label>نام</mat-label>
          <input matInput [formField]="userForm.name" autocomplete="name" />
          @if (userForm.name().touched() && userForm.name().errors().length) {
            <mat-error>{{ userForm.name().errors()[0].message }}</mat-error>
          }
        </mat-form-field>

        <mat-form-field appearance="outline">
          <mat-label>نام کاربری</mat-label>
          <input matInput [formField]="userForm.username" autocomplete="username" />
          @if (userForm.username().touched() && userForm.username().errors().length) {
            <mat-error>{{ userForm.username().errors()[0].message }}</mat-error>
          }
        </mat-form-field>

        <mat-form-field appearance="outline">
          <mat-label>{{
            data.mode === 'create' ? 'رمز عبور' : 'رمز عبور جدید (اختیاری)'
          }}</mat-label>
          <input
            matInput
            [type]="passwordVisible() ? 'text' : 'password'"
            [formField]="userForm.password"
            autocomplete="new-password"
          />
          <app-password-visibility-toggle matSuffix [(visible)]="passwordVisible" />
          @if (userForm.password().touched() && userForm.password().errors().length) {
            <mat-error>{{ userForm.password().errors()[0].message }}</mat-error>
          }
        </mat-form-field>

        <mat-form-field appearance="outline">
          <mat-label>نقش</mat-label>
          <mat-select [formField]="userForm.role">
            @for (option of roleOptions; track option) {
              <mat-option [value]="option">{{ roleLabels[option] }}</mat-option>
            }
          </mat-select>
        </mat-form-field>
      </mat-dialog-content>

      <mat-dialog-actions align="end">
        <button matButton type="button" mat-dialog-close>انصراف</button>
        <button matButton="filled" type="submit" [disabled]="userForm().submitting()">
          {{ data.mode === 'create' ? 'ثبت کاربر' : 'ذخیره تغییرات' }}
        </button>
      </mat-dialog-actions>
    </form>
  `,
  styleUrl: './user-form-dialog.scss',
})
export class UserFormDialog {
  private readonly dialogRef = inject(MatDialogRef<UserFormDialog, boolean>);
  protected readonly data = inject<UserFormDialogData>(MAT_DIALOG_DATA);
  private readonly usersGateway = inject(UsersGateway);

  protected readonly roleOptions = ROLE_OPTIONS;
  protected readonly roleLabels = ROLE_LABELS;

  private readonly initial = this.data.mode === 'edit' ? this.data.user : undefined;

  // The password never outlives the request it is sent on — see onSubmit below.
  private readonly model = signal<UserFormModel>({
    name: this.initial?.name ?? '',
    username: this.initial?.username ?? '',
    password: '',
    role: this.initial?.role ?? Role.reporter,
  });

  /** Whether the password field is showing its value in the clear — see the toggle in the suffix. */
  protected readonly passwordVisible = signal(false);

  protected readonly userForm = form(this.model, (path) => {
    if (this.data.mode === 'create') {
      required(path.name, { message: 'نام را وارد کنید.' });
      required(path.username, { message: 'نام کاربری را وارد کنید.' });
      required(path.password, { message: 'رمز عبور را وارد کنید.' });
      // The one place this app chooses a password, so the one place a floor can be enforced. An
      // edit is left alone deliberately: a blank field there means "keep the current password",
      // and existing accounts predate this rule.
      // The message spells the number in Persian digits, as the rest of the UI does (see
      // not-found-page's «۴۰۴»), so it cannot be interpolated from the constant.
      minLength(path.password, PASSWORD_MIN_LENGTH, {
        message: 'رمز عبور باید دست‌کم ۶ نویسه باشد.',
      });
    }
  });

  protected onSubmit(): Promise<boolean> {
    return submit(this.userForm, async () => {
      try {
        if (this.data.mode === 'create') {
          await firstValueFrom(this.usersGateway.register(this.model()));
        } else {
          await firstValueFrom(
            this.usersGateway.update(this.data.user.id, this.changesSinceEdit()),
          );
        }

        this.model.update((current) => ({ ...current, password: '' }));
        this.dialogRef.close(true);
        return undefined;
      } catch (error) {
        this.model.update((current) => ({ ...current, password: '' }));
        return mapUserFormError(error, this.userForm);
      }
    });
  }

  /**
   * Only the fields the admin actually touched. This is what keeps an edit that merely renames
   * someone from also resending their unchanged role — and `role` matters more than the others
   * here: the API treats its mere *presence* as "change my role", 409-ing whenever the caller
   * targets their own account, whether or not the value actually differs.
   */
  private changesSinceEdit(): UpdateUserDto {
    const current = this.model();
    const changes: UpdateUserDto = {};

    if (current.name !== '') {
      changes.name = current.name;
    }
    if (current.username !== '') {
      changes.username = current.username;
    }
    if (current.password !== '') {
      changes.password = current.password;
    }
    if (current.role !== this.initial?.role) {
      changes.role = current.role;
    }

    return changes;
  }
}
