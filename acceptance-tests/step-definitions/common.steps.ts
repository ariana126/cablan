import { Given, When, Then, DataTable } from '@cucumber/cucumber';
import { Actor, actorCalled, actorInTheSpotlight } from '@serenity-js/core';
import { LogInAsPersona, realNameFor } from '../screenplay/common/personas';
import { currentDailyBomList } from '../screenplay/common/daily-bom-list-context';
import {
  approveDailyBomAsAPrecondition,
  rejectDailyBomAsAPrecondition,
  theDailyBomWithOrderNumber,
} from '../screenplay/bom-analyzing/daily-bom-approval';
import { LetItBeNow } from '../screenplay/common/clock';
import { keepingTheSpotlight } from '../screenplay/common/spotlight';
import {
  EnsureDailyBomApprovalsShownInPanel,
  EnsureDailyBomsWithOrderNumbersShown,
  theProductInFocusOnTheDashboard,
} from '../screenplay/bom-analyzing/bom-dashboard-product-details';
import {
  EnsureDailyBomApprovalsShown,
  EnsureOnlyDailyBomsWithOrderNumbersShown,
} from '../screenplay/bom-reporting/bom-report-list';
import { EnsureAccessWasDenied } from '../screenplay/common/problem-detail';
import { EnsureRedirectedToLogIn } from '../screenplay/common/login';
import {
  EnsureAccessGranted,
  HasJustTriedToLogInThroughTheBrowser,
} from '../screenplay/authentication/logging-in';
import { EnsureListIsEmpty } from '../screenplay/common/data-table';
import {
  freshProductDetails,
  theProductRegisteredWithName,
} from '../screenplay/bom-registration/product-details';
import { RegisterProductUnlessRegistered } from '../screenplay/bom-registration/register-product';
import {
  NewStandardBomDetails,
  freshBrand,
  freshMiCode,
  freshStandardLength,
  rememberAttempt,
} from '../screenplay/bom-registration/standard-bom-details';
import {
  RegisterStandardBom,
  RegisterStandardBomAndRememberIt,
} from '../screenplay/bom-registration/register-standard-bom';
import {
  ensureCodeOfMaterialIs,
  ensureMaterialIsRegisteredWith,
  ensureTheMaterialsAreAsBefore,
  registerMaterialsAsAPrecondition,
} from '../screenplay/bom-registration/registered-materials';
import { currentMaterialStatementKind } from '../screenplay/common/material-statement-context';

// Steps whose text is byte-identical across more than one feature area — defined once here
// to avoid an ambiguous match. Two Given definitions exist for the same "actor has logged in"
// precondition because Persian's Given keyword is "با در نظر گرفتن " (note: NOT "...اینکه") —
// "اینکه" ("that") is part of the step TEXT, not the keyword. A standalone Given line therefore
// carries "اینکه" in its matched text, while the same sentence used as an "و" (And) continuation
// of a preceding Given does not, since "و" strips only itself.

/**
 * Logging in as a non-admin persona borrows یاشار's own actor object internally
 * (`screenplay/common/personas.ts`'s `ProvisionPersonaIfNeeded`) to register the account first,
 * which moves Serenity's spotlight to یاشار. Re-affirming it here — after the login itself has
 * completed — is what makes `actorInTheSpotlight()` reliable in every step that follows, since a
 * bare `Then` (no `{actor}`/`{pronoun}` of its own) is exactly how most of this scenario's
 * assertions are written.
 */
const logInAsPersonaAndKeepTheSpotlight = async (
  actor: Actor,
): Promise<void> => {
  await actor.attemptsTo(LogInAsPersona(actor.name));
  actorCalled(actor.name);
};

/**
 * The same sentence, with no «اینکه», is also logging-in.feature's outcome «انتظار می رود سینا وارد
 * سیستم شده باشد» — Cucumber matches by text alone, so one definition serves both. It is an outcome
 * exactly when this actor has just tried to log in through the `/login` page in this scenario
 * (`HasJustTriedToLogInThroughTheBrowser`, read off the actor's own per-scenario notepad): then it
 * checks access was granted; otherwise it makes the precondition true.
 */
const isLoggedIn = async (actor: Actor): Promise<void> => {
  if (await actor.answer(HasJustTriedToLogInThroughTheBrowser())) {
    return actor.attemptsTo(EnsureAccessGranted());
  }
  return logInAsPersonaAndKeepTheSpotlight(actor);
};

Given('{actor} وارد سیستم شده باشد', isLoggedIn);

// Shared by bom-analyzing, audit-logging and both bom-reporting report features: whichever list
// page a scenario is currently on, this just checks it renders no data rows — see
// `screenplay/common/data-table.ts#EnsureListIsEmpty`'s own comment for why that check needs no
// per-feature dispatch of its own.
Then('فهرست خالی نمایش داده شود', () =>
  actorInTheSpotlight().attemptsTo(EnsureListIsEmpty()),
);

Given('اینکه {actor} وارد سیستم شده باشد', logInAsPersonaAndKeepTheSpotlight);

Then('پیغام خطای عدم دسترسی نشان داده شود', () =>
  actorInTheSpotlight().attemptsTo(EnsureAccessWasDenied()),
);

// Shared by bom-analyzing and bom-reporting: an anonymous, unauthenticated visitor is
// turned away from a report/dashboard/export and asked to log in.
Then('از او خواسته شود وارد سیستم شود', () =>
  actorInTheSpotlight().attemptsTo(EnsureRedirectedToLogIn()),
);

/**
 * The very first line of registring-standard-bom.feature's background, running before either
 * background line that names an actor — so there's nobody in the spotlight yet to act as. یاشار
 * (the one persona the backend seeds on startup — `screenplay/common/personas.ts`) does the
 * registering instead, the same way `personas.ts#ProvisionPersonaIfNeeded` already borrows یاشار's
 * own actor object for test-data setup that has to happen before the scenario's real actor is known.
 *
 * Idempotent within a scenario — registring-standard-bom.feature's Persian-digit examples repeat
 * the background line, and product names are unique (`RegisterProductUnlessRegistered`).
 */
Given('اینکه محصول {string} در سیستم ثبت شده باشد', (productName: string) =>
  actorCalled('یاشار').attemptsTo(
    LogInAsPersona('یاشار'),
    RegisterProductUnlessRegistered(freshProductDetails({ name: productName })),
  ),
);

/**
 * registring-standard-bom.feature's top-level "ثبت آنالیز استاندارد جدید" scenario — the UI door,
 * per the dispatch this automation was written against. Drafts fresh MI code/brand/standard
 * length/active(=true) and drives the real "new standard BOM" form, which is assumed to clone
 * `productName`'s current composition once selected (see
 * `register-standard-bom.ts#RegisterStandardBom.using`'s own comment).
 */
When(
  '{actor} آنالیز استاندارد جدید برای محصول {string} ثبت می کند',
  (actor: Actor, productName: string) => {
    const product = theProductRegisteredWithName(productName);
    const details: NewStandardBomDetails = {
      productId: product.id,
      productName: product.name,
      miCode: freshMiCode(),
      brand: freshBrand(),
      standardLength: freshStandardLength(),
      active: true,
      components: [],
    };
    rememberAttempt<NewStandardBomDetails>(details);
    return actor.attemptsTo(RegisterStandardBom.using(product, details));
  },
);

/**
 * Backs registring-standard-bom.feature's "ویرایش آنالیز استاندارد" scenario as well as its own
 * access-denied edit/delete outlines — all three precede this with a background that's already
 * registered `productName` and logged an actor in, so `actorInTheSpotlight()` is safe here. Kept
 * byte-for-byte distinct from the "در سیستم"-carrying Given of the same shape in
 * `step-definitions/bom-registration/registring-standard-bom.steps.ts`, which backs a different set
 * of examples in the same feature — see that file's own comment.
 */
Given(
  'اینکه یک آنالیز استاندارد برای محصول {string} ثبت شده باشد',
  (productName: string) => {
    const product = theProductRegisteredWithName(productName);
    return actorInTheSpotlight().attemptsTo(
      RegisterStandardBomAndRememberIt(product),
    );
  },
);

// "... توسط مصطفی تایید شده باشد" — the approval precondition approving-bom, bom-dashboard,
// reporting-bom and exporting-bom all state. Two definitions for one sentence, for the
// "اینکه"-or-not reason given at the top of this file: approving-bom and bom-dashboard open a
// `Given` with it, the two bom-reporting backgrounds continue one with "و". The approver acts
// behind the scenes, so `{actorName}`: whoever was in the spotlight stays there.
const approvedBy = (orderNumber: string, approverName: string) =>
  approveDailyBomAsAPrecondition(
    theDailyBomWithOrderNumber(orderNumber),
    approverName,
  );

Given(
  'اینکه آنالیز روزانه با شماره سفارش {string} توسط {actorName} تایید شده باشد',
  approvedBy,
);

Given(
  'آنالیز روزانه با شماره سفارش {string} توسط {actorName} تایید شده باشد',
  approvedBy,
);

// "... توسط مصطفی با دلیل «...» عدم تایید شده باشد" — the rejection counterpart, stated by
// approving-bom, reporting-bom and exporting-bom (opening a `Given`, so with "اینکه") and by
// bom-dashboard (continuing one with "و", so without).
const rejectedBy = (
  orderNumber: string,
  reviewerName: string,
  reason: string,
) =>
  rejectDailyBomAsAPrecondition(
    theDailyBomWithOrderNumber(orderNumber),
    reviewerName,
    reason,
  );

Given(
  'اینکه آنالیز روزانه با شماره سفارش {string} توسط {actorName} با دلیل {string} عدم تایید شده باشد',
  rejectedBy,
);

Given(
  'آنالیز روزانه با شماره سفارش {string} توسط {actorName} با دلیل {string} عدم تایید شده باشد',
  rejectedBy,
);

// «اکنون «1403/06/15» ساعت «10:00» باشد» — stated by daily-bom-edit-details, approving-bom and
// viewing-audit-log before an edit whose heading names the minute. A Jalali date and an Asia/Tehran
// wall-clock time, frozen on the system's clock (and the suite's mirror of it) — see
// `screenplay/common/clock.ts#LetItBeNow`. The clock answers anyone, so whoever does it is borrowed
// without moving the spotlight.
const letItBeNow = (date: string, time: string) =>
  keepingTheSpotlight(() =>
    actorCalled('یاشار').attemptsTo(LetItBeNow(date, time)),
  );

Given('اکنون {string} ساعت {string} باشد', letItBeNow);

// The same, opening a `Given` — recording-maintenance-execution's «با در نظر گرفتن اینکه اکنون
// «1405/07/01» ساعت «10:30» باشد», stated before anyone logs in.
Given('اینکه اکنون {string} ساعت {string} باشد', letItBeNow);

// The material facts importing-materials and viewing-audit-log's bulk-import rules both state, read
// over the API by an observer so the acting actor's last response survives for a «پیغام خطای …»
// that follows (`registered-materials.ts`). The materials are noted by the step that imports,
// confirms or reverts.
Then('هیچ تغییری در مواد اولیه سیستم اعمال نشده باشد', () =>
  ensureTheMaterialsAreAsBefore('the change'),
);

Then('کد مواد اولیه {string} {string} باشد', (name: string, code: string) =>
  ensureCodeOfMaterialIs(name, code),
);

// An outcome in importing-materials («انتظار می رود مواد اولیه "آلومینیوم" با کد "A-1" …»), a
// precondition in viewing-audit-log («و مواد اولیه "روی" با کد "M-101" …», one «<تغییر بعدی>») —
// `material-statement-context.ts`, set by each feature's background.
Given(
  'مواد اولیه {string} با کد {string} در سیستم ثبت شده باشد',
  (name: string, code: string) =>
    currentMaterialStatementKind() === 'outcome'
      ? ensureMaterialIsRegisteredWith(name, code)
      : registerMaterialsAsAPrecondition([{ name, code }]),
);

// The edit-then-approve preconditions approving-bom and viewing-audit-log state — once one shared
// sentence, «… وزن مواد اولیه … آن را به … تغییر داده و سپس آن را تایید کرده باشد» — now say «از
// داشبورد» and differ (one names a reason, one doesn't), so each lives with its own feature:
// approving-bom.steps.ts and viewing-audit-log.steps.ts.

const splitValues = (csv: string): string[] =>
  csv.split(',').map((value) => value.trim());

// The two `Then`s below read the same sentence off two different pages: the daily-BOM report list
// in reporting-bom.feature, a product's panel on the dashboard in bom-dashboard.feature. They
// dispatch on whichever of those two backgrounds last ran — `daily-bom-list-context.ts`.

Then(
  'فقط آنالیز های روزانه با شماره سفارش {string} نمایش داده شود',
  (orderNumbersCsv: string) =>
    actorInTheSpotlight().attemptsTo(
      currentDailyBomList() === 'dashboard'
        ? EnsureDailyBomsWithOrderNumbersShown(
            theProductInFocusOnTheDashboard(),
            splitValues(orderNumbersCsv),
          )
        : EnsureOnlyDailyBomsWithOrderNumbersShown(orderNumbersCsv),
    ),
);

// The reviewer column names a persona the way the business does; the page shows the name the
// backend stores, which differs only for یاشار (`personas.ts#realNameFor`). "-" is no reviewer.
Then(
  'وضعیت تایید آنالیز های روزانه به صورت زیر نمایش داده شود',
  (table: DataTable) => {
    const expected = table.hashes().map((row) => ({
      orderNumber: row['شماره سفارش'],
      approvalStatus: row['وضعیت تایید'],
      reviewedBy:
        row['تایید/رد کننده'] === '-'
          ? '-'
          : realNameFor(row['تایید/رد کننده']),
    }));
    return actorInTheSpotlight().attemptsTo(
      currentDailyBomList() === 'dashboard'
        ? EnsureDailyBomApprovalsShownInPanel(
            theProductInFocusOnTheDashboard(),
            expected,
          )
        : EnsureDailyBomApprovalsShown(expected),
    );
  },
);
