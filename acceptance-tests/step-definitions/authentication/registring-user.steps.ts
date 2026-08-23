import { Given, When, Then } from '@cucumber/cucumber';
import { Actor, actorInTheSpotlight } from '@serenity-js/core';
import { EnsureValidationErrorFor } from '../../screenplay/common/problem-detail';
import { asSystemRole } from '../../screenplay/common/roles';
import {
  AttemptToRegisterLeavingEmpty,
  AttemptToRegisterWithInvalidRole,
  EnsureNewUserWasNotRegistered,
  EnsureUsernameWasAlreadyTaken,
  EnsureUserWasRegistered,
  EnterNewUserDetails,
  RegisterUser,
  RegisterUserAndRememberIt,
} from '../../screenplay/authentication/register-user';
import {
  ChangeOwnRole,
  EditUser,
  EnsureCannotChangeOwnRole,
  EnsureUserWasEditedWith,
  EnsureUserWasNotEdited,
} from '../../screenplay/authentication/edit-user';
import {
  DeleteUser,
  EnsureUserWasDeleted,
  EnsureUserWasNotDeleted,
} from '../../screenplay/authentication/delete-user';
import {
  EnsureUserListWasNotDisplayed,
  ViewUserList,
} from '../../screenplay/authentication/view-user-list';
import {
  freshUserDetails,
  NewUserDetails,
  rememberAttempt,
  theAttempt,
  theLastRegisteredUser,
  theUserRegisteredWithUsername,
} from '../../screenplay/authentication/user-details';

// سناریو: ثبت کاربر جدید

When('{actor} کاربر جدیدی با اطلاعات معتبر ثبت می کند', (actor: Actor) => {
  const details = freshUserDetails();
  rememberAttempt<NewUserDetails>(details);
  return actor.attemptsTo(RegisterUser.viaApiUsing(details));
});

Then('کاربر جدید در سیستم ثبت شده باشد', () =>
  actorInTheSpotlight().attemptsTo(
    EnsureUserWasRegistered(theAttempt<NewUserDetails>()),
  ),
);

// سناریو: ویرایش کاربر

Given('اینکه یک کاربر در سیستم ثبت شده باشد', () =>
  actorInTheSpotlight().attemptsTo(
    RegisterUserAndRememberIt(freshUserDetails()),
  ),
);

When('{actor} اطلاعات آن کاربر را ویرایش می کند', (actor: Actor) => {
  const changes: Partial<NewUserDetails> = { name: freshUserDetails().name };
  rememberAttempt<Partial<NewUserDetails>>(changes);
  return actor.attemptsTo(
    EditUser.viaApiUsing(theLastRegisteredUser().id, changes),
  );
});

Then('اطلاعات ویرایش شده کاربر در سیستم ثبت شده باشد', () =>
  actorInTheSpotlight().attemptsTo(
    EnsureUserWasEditedWith(theAttempt<Partial<NewUserDetails>>()),
  ),
);

// سناریو: حذف کاربر

When('{actor} آن کاربر را حذف می کند', (actor: Actor) =>
  actor.attemptsTo(DeleteUser.viaApiUsing(theLastRegisteredUser().id)),
);

Then('آن کاربر از سیستم حذف شده باشد', () =>
  actorInTheSpotlight().attemptsTo(EnsureUserWasDeleted()),
);

// قانون: فقط مدیر سیستم مجاز به مشاهده لیست کاربران است

When('{actor} تلاش می کند لیست کاربران را مشاهده کند', (actor: Actor) =>
  actor.attemptsTo(ViewUserList()),
);

Then('لیست کاربران نمایش داده نشود', () =>
  actorInTheSpotlight().attemptsTo(EnsureUserListWasNotDisplayed()),
);

// قانون: فقط مدیر سیستم مجاز به ثبت، ویرایش یا حذف کاربر است

When('{actor} تلاش می کند کاربر جدیدی ثبت کند', (actor: Actor) =>
  actor.attemptsTo(RegisterUser.viaApiUsing(freshUserDetails())),
);

Then('کاربر جدیدی ثبت نشده باشد', () =>
  actorInTheSpotlight().attemptsTo(EnsureNewUserWasNotRegistered()),
);

When('{actor} تلاش می کند اطلاعات آن کاربر را ویرایش کند', (actor: Actor) =>
  actor.attemptsTo(
    EditUser.viaApiUsing(theLastRegisteredUser().id, {
      name: 'تلاش بدون دسترسی',
    }),
  ),
);

Then('کاربر ویرایش نشده باشد', () =>
  actorInTheSpotlight().attemptsTo(EnsureUserWasNotEdited()),
);

When('{actor} تلاش می کند آن کاربر را حذف کند', (actor: Actor) =>
  actor.attemptsTo(DeleteUser.viaApiUsing(theLastRegisteredUser().id)),
);

Then('آن کاربر از سیستم حذف نشده باشد', () =>
  actorInTheSpotlight().attemptsTo(EnsureUserWasNotDeleted()),
);

// قانون: اسم کاربر نمی تواند خالی باشد

When('{actor} اطلاعات کاربر جدید را وارد می کند', (actor: Actor) =>
  actor.attemptsTo(EnterNewUserDetails(freshUserDetails())),
);

When('اسم کاربر را خالی می گذارد', () =>
  actorInTheSpotlight().attemptsTo(AttemptToRegisterLeavingEmpty('name')),
);

Then('پیغام خطای اسم کاربر نشان داده شود', () =>
  actorInTheSpotlight().attemptsTo(EnsureValidationErrorFor('name')),
);

When('{actor} اسم آن کاربر را پاک می کند', (actor: Actor) =>
  actor.attemptsTo(
    EditUser.viaApiUsing(theLastRegisteredUser().id, { name: '' }),
  ),
);

// قانون: نام کاربری نمی تواند خالی باشد

When('نام کاربری را خالی می گذارد', () =>
  actorInTheSpotlight().attemptsTo(AttemptToRegisterLeavingEmpty('username')),
);

Then('پیغام خطای نام کاربری نشان داده شود', () =>
  actorInTheSpotlight().attemptsTo(EnsureValidationErrorFor('username')),
);

When('{actor} نام کاربری آن کاربر را پاک می کند', (actor: Actor) =>
  actor.attemptsTo(
    EditUser.viaApiUsing(theLastRegisteredUser().id, { username: '' }),
  ),
);

// قانون: نام کاربری هر کاربر باید یکتا باشد

Given(
  'اینکه کاربری با نام کاربری {string} در سیستم ثبت شده باشد',
  (username: string) =>
    actorInTheSpotlight().attemptsTo(
      RegisterUserAndRememberIt(freshUserDetails({ username })),
    ),
);

When(
  '{actor} کاربر جدیدی با نام کاربری {string} ثبت می کند',
  (actor: Actor, username: string) => {
    const details = freshUserDetails({ username });
    rememberAttempt<NewUserDetails>(details);
    return actor.attemptsTo(RegisterUser.viaApiUsing(details));
  },
);

Then('پیغام خطای تکراری بودن نام کاربری نشان داده شود', () =>
  actorInTheSpotlight().attemptsTo(EnsureUsernameWasAlreadyTaken()),
);

Given(
  'اینکه کاربری با نام کاربری {string} و کاربر دیگری با نام کاربری {string} در سیستم ثبت شده باشد',
  (usernameA: string, usernameB: string) =>
    actorInTheSpotlight().attemptsTo(
      RegisterUserAndRememberIt(freshUserDetails({ username: usernameA })),
      RegisterUserAndRememberIt(freshUserDetails({ username: usernameB })),
    ),
);

When(
  '{actor} نام کاربری {string} را به {string} تغییر می دهد',
  (actor: Actor, fromUsername: string, toUsername: string) => {
    const target = theUserRegisteredWithUsername(fromUsername);
    const changes: Partial<NewUserDetails> = { username: toUsername };
    rememberAttempt<Partial<NewUserDetails>>(changes);
    return actor.attemptsTo(EditUser.viaApiUsing(target.id, changes));
  },
);

// قانون: رمز عبور نمی تواند خالی باشد

When('رمز عبور را خالی می گذارد', () =>
  actorInTheSpotlight().attemptsTo(AttemptToRegisterLeavingEmpty('password')),
);

Then('پیغام خطای رمز عبور نشان داده شود', () =>
  actorInTheSpotlight().attemptsTo(EnsureValidationErrorFor('password')),
);

When('{actor} رمز عبور آن کاربر را پاک می کند', (actor: Actor) =>
  actor.attemptsTo(
    EditUser.viaApiUsing(theLastRegisteredUser().id, { password: '' }),
  ),
);

// قانون: نقش کاربر باید یکی از نقش های معتبر سیستم باشد

When('نقشی نامعتبر برای او انتخاب می کند', () =>
  actorInTheSpotlight().attemptsTo(AttemptToRegisterWithInvalidRole()),
);

Then('پیغام خطای نقش نامعتبر نشان داده شود', () =>
  actorInTheSpotlight().attemptsTo(EnsureValidationErrorFor('role')),
);

When(
  '{actor} کاربر جدیدی با نقش {string} ثبت می کند',
  (actor: Actor, role: string) => {
    const details = freshUserDetails({ role: asSystemRole(role) });
    rememberAttempt<NewUserDetails>(details);
    return actor.attemptsTo(RegisterUser.viaApiUsing(details));
  },
);

Then('کاربر جدید با نقش {string} در سیستم ثبت شده باشد', (_role: string) =>
  actorInTheSpotlight().attemptsTo(
    EnsureUserWasRegistered(theAttempt<NewUserDetails>()),
  ),
);

// قانون: مدیر سیستم نمی تواند نقش خودش را تغییر دهد

When('{actor} نقش خودش را تغییر می دهد', (actor: Actor) =>
  // Any role other than مدیر سیستم itself would do — the backend rejects the attempt purely
  // because the caller is targeting their own id with a role field present, regardless of value
  // (`backend/.../identity/application/commands/update-user/update-user.handler.ts`).
  actor.attemptsTo(ChangeOwnRole('مدیریت')),
);

Then('پیغام خطای عدم امکان تغییر نقش خود نشان داده شود', () =>
  actorInTheSpotlight().attemptsTo(EnsureCannotChangeOwnRole()),
);
