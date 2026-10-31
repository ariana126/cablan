import { Actor, actorCalled } from '@serenity-js/core';
import { RegisterBom } from '../bom-registration/register-bom';
import { RegisterStandardBomWithMiCodeUnlessRegistered } from '../bom-registration/register-standard-bom';
import {
  freshMiCode,
  theStandardBomRegisteredWithMiCode,
} from '../bom-registration/standard-bom-details';
import {
  NewBomDetails,
  freshBomDetailsFor,
  rememberAttempt,
} from '../bom-registration/bom-details';
import { LogInAsPersona } from '../common/personas';
import { keepingTheSpotlight } from '../common/spotlight';

/**
 * «{actor} از صفحه اصلی ثبت آنالیز روزانه جدیدی را آغاز می کند و آن را با اطلاعات معتبر ثبت می
 * کند» — the home-page shortcut, then the ordinary daily-BOM form with valid details.
 *
 * "Valid details" need a standard BOM to pick, which the scenario takes for granted rather than
 * stating, so the system admin registers a fresh one (with its product) over the API first, without
 * taking the spotlight. The attempt is remembered for registring-bom's «آنالیز روزانه جدیدی ثبت
 * شده باشد», which reads `GET boms` for its order number — the preview the registration leaves
 * open hides the list from role locators (`acceptance-tests/CLAUDE.md`).
 */
export const registerDailyBomFromTheHomePage = async (
  actor: Actor,
): Promise<void> => {
  const miCode = freshMiCode();
  await keepingTheSpotlight(() =>
    actorCalled('یاشار').attemptsTo(
      LogInAsPersona('یاشار'),
      RegisterStandardBomWithMiCodeUnlessRegistered(miCode),
    ),
  );
  const standardBom = theStandardBomRegisteredWithMiCode(miCode);
  const details = freshBomDetailsFor(standardBom, []);
  rememberAttempt<NewBomDetails>(details);
  await actor.attemptsTo(
    RegisterBom.fromTheHomePageUsing(standardBom, details),
  );
};
