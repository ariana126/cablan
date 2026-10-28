import { DataTable, Given, Then, When } from '@cucumber/cucumber';
import { Actor, actorInTheSpotlight } from '@serenity-js/core';
import {
  AttemptToChangeMaterialWeights,
  ensureMaterialWeightsAsAPrecondition,
  changeMaterialWeightsAsAPrecondition,
  SaveDailyBomUnchanged,
  thatDailyBom,
} from '../../screenplay/bom-analyzing/daily-bom-approval';
import {
  A_NEW_WEIGHT_FOR_ONE_MATERIAL,
  ChangeThatDailyBom,
  dailyBomChangeFrom,
  aWeightChange,
  EnsureEditDetailsOfThatDailyBomAre,
  EnsureEditDetailsShown,
  EnsureMaterialWeightOfThatDailyBomIs,
  EnsureNoEditDetailsForThatDailyBom,
  EnsureNoEditEventRecordedForThatDailyBom,
  EnsureToldAnEditReasonIsRequired,
  ensureTrackingNumberOfThatDailyBomAsAPrecondition,
  registerDailyBomWithWeightAndSeeItsPreviewAsAPrecondition,
  ViewEditDetails,
} from '../../screenplay/bom-analyzing/daily-bom-edit-details';
import {
  aCorrection,
  AN_EDIT_REASON_OF_SPACES_ONLY,
  anEditFromTheDashboard,
  NO_EDIT_REASON,
} from '../../screenplay/common/edit-reason';
import { rememberAttempt } from '../../screenplay/bom-registration/bom-details';
import { BomFormEdit } from '../../screenplay/bom-registration/edit-bom';
import { setCurrentEditTarget } from '../../screenplay/common/edit-target';

// daily-bom-edit-details.feature — see `screenplay/bom-analyzing/daily-bom-edit-details.ts`'s module
// comment for which door each step takes and why.
//
// Defined elsewhere, shared with other features:
// - «اینکه آنالیز روزانه ای با شماره سفارش … در سیستم ثبت شده باشد», «وضعیت آن آنالیز روزانه … باقی
//   بماند», «توضیحات مدیریت آن آنالیز روزانه به صورت زیر باشد» and «… از داشبورد وزن مواد اولیه … را
//   با دلیل … به … تغییر می دهد و سپس آن را تایید می کند» — approving-bom.steps.ts.
// - «اکنون … ساعت … باشد», «… وارد سیستم شده باشد», «… توسط … تایید شده باشد» —
//   step-definitions/common.steps.ts.
// - «اینکه … آنالیز روزانه جدیدی برای کد MI … ثبت کرده و پیش نمایش آن به او نشان داده شده باشد» —
//   registring-bom.steps.ts; «اطلاعات ویرایش شده در سیستم ثبت شده باشد» —
//   bom-registration/common.steps.ts.

/** One material's weight, the way the Gherkin names it. */
const weight = (
  materialName: string,
  componentName: string,
  value: string,
) => ({
  componentName,
  materialName,
  weight: Number(value),
});

/** A one-column table, as its lines in order. */
const linesFrom = (table: DataTable, column: string): string[] =>
  table.hashes().map((row) => row[column]);

// پیش زمینه

// Registered at 3 already (`daily-bom-approval.ts#INITIAL_WEIGHT_TO_REVIEW`), so this only checks —
// an edit made here would be recorded in the edit details the scenarios assert.
Given(
  'وزن مواد اولیه {string} جز {string} آن برابر {string} باشد',
  (materialName: string, componentName: string, value: string) =>
    ensureMaterialWeightsAsAPrecondition(thatDailyBom(), [
      weight(materialName, componentName, value),
    ]),
);

// قانون: هیچ ویرایشی … بدون نوشتن دلیل ثبت نمی شود

When(
  '{actor} وزن مواد اولیه {string} جز {string} آن آنالیز روزانه را از لیست آنالیز های روزانه با دلیل {string} به {string} تغییر می دهد',
  (
    actor: Actor,
    materialName: string,
    componentName: string,
    reason: string,
    value: string,
  ) =>
    actor.attemptsTo(
      ChangeThatDailyBom.fromTheDailyBomList(
        [aWeightChange(weight(materialName, componentName, value))],
        reason,
      ),
    ),
);

When(
  '{actor} وزن مواد اولیه {string} جز {string} آن آنالیز روزانه را از داشبورد با دلیل {string} به {string} تغییر می دهد',
  (
    actor: Actor,
    materialName: string,
    componentName: string,
    reason: string,
    value: string,
  ) =>
    actor.attemptsTo(
      ChangeThatDailyBom.fromTheDashboard(
        weight(materialName, componentName, value),
        reason,
      ),
    ),
);

Then(
  'وزن مواد اولیه {string} جز {string} آن آنالیز روزانه {string} باشد',
  (materialName: string, componentName: string, value: string) =>
    actorInTheSpotlight().attemptsTo(
      EnsureMaterialWeightOfThatDailyBomIs(
        weight(materialName, componentName, value),
      ),
    ),
);

Then(
  'وزن مواد اولیه {string} جز {string} آن آنالیز روزانه {string} باقی بماند',
  (materialName: string, componentName: string, value: string) =>
    actorInTheSpotlight().attemptsTo(
      EnsureMaterialWeightOfThatDailyBomIs(
        weight(materialName, componentName, value),
      ),
    ),
);

// The registration is the shared preview `Given`'s; the edit details of a preview edit are another
// example's, so this one checks only that the edit took — the shared «اطلاعات ویرایش شده …» `Then`,
// which reads the first material's weight back.
When(
  '{actor} از پیش نمایش وزن یکی از مواد اولیه آن را با دلیل {string} تغییر می دهد',
  (actor: Actor, reason: string) => {
    setCurrentEditTarget('bom');
    rememberAttempt<BomFormEdit>({
      firstMaterialWeight: A_NEW_WEIGHT_FOR_ONE_MATERIAL,
    });
    return actor.attemptsTo(
      ChangeThatDailyBom.oneMaterialWeightFromThePreview(reason),
    );
  },
);

When(
  '{actor} تلاش می کند وزن مواد اولیه {string} جز {string} آن آنالیز روزانه را بدون نوشتن دلیل به {string} تغییر دهد',
  (actor: Actor, materialName: string, componentName: string, value: string) =>
    actor.attemptsTo(
      AttemptToChangeMaterialWeights.viaApi(
        thatDailyBom(),
        [weight(materialName, componentName, value)],
        aCorrection(NO_EDIT_REASON),
      ),
    ),
);

When(
  '{actor} تلاش می کند وزن مواد اولیه {string} جز {string} آن آنالیز روزانه را از داشبورد بدون نوشتن دلیل به {string} تغییر دهد',
  (actor: Actor, materialName: string, componentName: string, value: string) =>
    actor.attemptsTo(
      AttemptToChangeMaterialWeights.viaApi(
        thatDailyBom(),
        [weight(materialName, componentName, value)],
        anEditFromTheDashboard(NO_EDIT_REASON),
      ),
    ),
);

When(
  '{actor} تلاش می کند وزن مواد اولیه {string} جز {string} آن آنالیز روزانه را با دلیلی که فقط از فاصله تشکیل شده به {string} تغییر دهد',
  (actor: Actor, materialName: string, componentName: string, value: string) =>
    actor.attemptsTo(
      AttemptToChangeMaterialWeights.viaApi(
        thatDailyBom(),
        [weight(materialName, componentName, value)],
        aCorrection(AN_EDIT_REASON_OF_SPACES_ONLY),
      ),
    ),
);

Then('به او گفته شود که نوشتن دلیل ویرایش لازم است', () =>
  actorInTheSpotlight().attemptsTo(EnsureToldAnEditReasonIsRequired()),
);

// قانون: ذخیره آنالیز روزانه بدون هیچ تغییری، ویرایش حساب نمی شود

When(
  '{actor} آن آنالیز روزانه را بدون هیچ تغییری و بدون نوشتن دلیل ذخیره می کند',
  (actor: Actor) =>
    actor.attemptsTo(SaveDailyBomUnchanged.viaApi(thatDailyBom())),
);

Then('جزئیات ویرایشی برای آن آنالیز روزانه ثبت نشده باشد', () =>
  actorInTheSpotlight().attemptsTo(EnsureNoEditDetailsForThatDailyBom()),
);

Then(
  'هیچ رویداد ویرایشی برای آن آنالیز روزانه در رویدادهای سیستم ثبت نشده باشد',
  () =>
    actorInTheSpotlight().attemptsTo(
      EnsureNoEditEventRecordedForThatDailyBom(),
    ),
);

// قانون: برای هر ویرایش از لیست آنالیز های روزانه یا از پیش نمایش پس از ثبت … به عنوان جزئیات
// ویرایش ثبت می شود

// Also approving-bom.feature's «ویرایش مدیریت از صفحه آنالیز های روزانه در توضیحات مدیریت نمی آید».
Then('جزئیات ویرایش آن آنالیز روزانه به صورت زیر باشد', (table: DataTable) =>
  actorInTheSpotlight().attemptsTo(
    EnsureEditDetailsOfThatDailyBomAre(linesFrom(table, 'جزئیات ویرایش')),
  ),
);

Given(
  'اینکه شماره ردیابی آن آنالیز روزانه {string} باشد',
  (trackingNumber: string) =>
    ensureTrackingNumberOfThatDailyBomAsAPrecondition(trackingNumber),
);

When(
  '{actor} آن آنالیز روزانه را از لیست آنالیز های روزانه با دلیل {string} به صورت زیر تغییر می دهد',
  (actor: Actor, reason: string, table: DataTable) =>
    actor.attemptsTo(
      ChangeThatDailyBom.fromTheDailyBomList(
        table
          .hashes()
          .map((row) => dailyBomChangeFrom(row['فیلد'], row['مقدار جدید'])),
        reason,
      ),
    ),
);

// Passive, yet through the browser, like the shared preview `Given` — see
// `registerDailyBomWithWeightAndSeeItsPreviewAsAPrecondition`. `{actorName}`: it must not move the
// spotlight off whoever the background left there.
Given(
  'اینکه {actorName} آنالیز روزانه جدیدی برای کد MI {string} که وزن مواد اولیه {string} جز {string} آن {string} است ثبت کرده و پیش نمایش آن به او نشان داده شده باشد',
  (
    actorName: string,
    miCode: string,
    materialName: string,
    componentName: string,
    value: string,
  ) =>
    registerDailyBomWithWeightAndSeeItsPreviewAsAPrecondition(
      actorName,
      miCode,
      weight(materialName, componentName, value),
    ),
);

When(
  '{actor} از پیش نمایش وزن مواد اولیه {string} جز {string} آن را با دلیل {string} به {string} تغییر می دهد',
  (
    actor: Actor,
    materialName: string,
    componentName: string,
    reason: string,
    value: string,
  ) =>
    actor.attemptsTo(
      ChangeThatDailyBom.fromThePreview(
        [aWeightChange(weight(materialName, componentName, value))],
        reason,
      ),
    ),
);

// قانون: جزئیات هر ویرایش تازه به انتهای جزئیات ویرایش های قبلی اضافه می شود

Given(
  'اینکه {actorName} وزن مواد اولیه {string} جز {string} آن آنالیز روزانه را از لیست آنالیز های روزانه با دلیل {string} به {string} تغییر داده باشد',
  (
    editorName: string,
    materialName: string,
    componentName: string,
    reason: string,
    value: string,
  ) =>
    changeMaterialWeightsAsAPrecondition(
      thatDailyBom(),
      editorName,
      [weight(materialName, componentName, value)],
      aCorrection(reason),
    ),
);

// قانون: همه کاربران جزئیات ویرایش آنالیز روزانه را می بینند

When(
  '{actor} جزئیات آنالیز روزانه با شماره سفارش {string} را مشاهده می کند',
  (actor: Actor, orderNumber: string) =>
    actor.attemptsTo(ViewEditDetails.inTheDailyBomList(orderNumber)),
);

When(
  '{actor} آنالیز روزانه با شماره سفارش {string} را در داشبورد مشاهده می کند',
  (actor: Actor, orderNumber: string) =>
    actor.attemptsTo(ViewEditDetails.onTheDashboard(orderNumber)),
);

Then(
  'جزئیات ویرایش زیر به {actor} نشان داده شود',
  (actor: Actor, table: DataTable) =>
    actor.attemptsTo(EnsureEditDetailsShown(linesFrom(table, 'جزئیات ویرایش'))),
);
