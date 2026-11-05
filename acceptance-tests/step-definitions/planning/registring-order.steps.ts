import { DataTable, Given, Then, When } from '@cucumber/cucumber';
import { Actor, actorInTheSpotlight } from '@serenity-js/core';
import {
  performAsAnObserverOtherThanTheActor,
  performAsTheSystemAdmin,
} from '../../screenplay/common/observer';
import { withLatinDigits } from '../../screenplay/common/persian-digits';
import { triedThrough } from '../../screenplay/common/refusal-door-context';
import { theOrderWasChangedThrough } from '../../screenplay/common/order-door-context';
import { theOrderNumberIsTypedInto } from '../../screenplay/common/order-number-form-context';
import { RegisterStandardBomForProductUnlessRegistered } from '../../screenplay/bom-registration/register-standard-bom';
import {
  freshOrderNumber,
  theLastRegisteredBom,
} from '../../screenplay/bom-registration/bom-details';
import {
  dailyBomsAreRegisteredForOrder,
  EnsureDailyBomHasOrderNumber,
  EnsureEveryDailyBomOfOrder,
  EnsureNoDailyBomHasOrderNumber,
} from '../../screenplay/bom-registration/daily-bom-order';
import {
  DefineOrder,
  EnterNewOrderDetails,
} from '../../screenplay/planning/define-order';
import { AddMiCodeToOrder } from '../../screenplay/planning/order-mi-codes';
import {
  AttemptToEditOrder,
  CorrectOrderNumber,
  EditOrder,
} from '../../screenplay/planning/edit-order';
import { DeleteOrder } from '../../screenplay/planning/delete-order';
import {
  NoteTheOrders,
  theOrdersNotedBeforeTheAttempt,
} from '../../screenplay/planning/order-details';
import {
  EnsureNoNewOrderWasDefined,
  EnsureOrderHoldsExactly,
  EnsureOrderHoldsMiCodeOnce,
  EnsureOrderIsDefined,
  EnsureOrderIsNotDefined,
  EnsureOrderIsUnchanged,
  EnsureTheOrdersAre,
  EnsureToldAnOrderNeedsAnMiCode,
  EnsureToldTheMiCodeIsAlreadyAssigned,
  EnsureToldTheMiCodeIsNotDefined,
  EnsureToldTheOrderNumberIsTaken,
} from '../../screenplay/planning/order-facts';
import {
  CarryOverLegacyOrders,
  EnsureLegacyDailyBomsAreUnchanged,
  legacyDailyBomsWereRegistered,
} from '../../screenplay/planning/legacy-orders';

// قابلیت: تعریف سفارش و تخصیص کد MI (issue #101)
//
// Doors. The plain active `When`s — define, add an MI code, edit, delete, the System Admin's
// renumbering with or without the correction confirmation — go through `/orders`
// (`screenplay/planning/`, locators in `ui/orders-page.ts`). Every «تلاش …» goes over HTTP: who may
// change an order, and what makes a change invalid or refused, are the backend's rules, and their
// «پیغام خطای …» / «به او گفته شود …» assert the problem the API answered. Every precondition and
// every fact goes through the API as the System Admin (`common/observer.ts`), so the actor's own
// last response survives for the step that judges it — or, when the System Admin is himself the
// actor («مدیر سیستم هم کد MI استفاده شده را از سفارش برنمی دارد», the renumberings), as مصطفی
// (`performAsAnObserverOtherThanTheActor`), since reading as یاشار would overwrite that response.
//
// Shared elsewhere: the order Givens and «(اینکه) آنالیز روزانه ای برای سفارش … با کد MI … ثبت شده
// باشد», «شماره سفارش را خالی میگذارد», «پیغام خطای شماره سفارش نشان داده شود» and «آن آنالیز روزانه
// شماره سفارش … را داشته باشد» — step-definitions/common.steps.ts; «{actor} وارد سیستم شده باشد» and
// «پیغام خطای عدم دسترسی نشان داده شود» — the same file; «به او گفته شود که … در 1 آنالیز روزانه …
// استفاده شده است» — registring-standard-bom.steps.ts; «آنالیز روزانه … توسط مصطفی تایید شده باشد» —
// registring-material.steps.ts; «وضعیت آن آنالیز روزانه … باقی بماند» — approving-bom.steps.ts.

// پیش زمینه

const standardBomIsRegisteredForProduct = (
  miCode: string,
  productName: string,
) =>
  performAsTheSystemAdmin(
    RegisterStandardBomForProductUnlessRegistered(miCode, productName),
  );

Given(
  'اینکه آنالیز استانداردی با کد MI {string} برای محصول {string} در سیستم ثبت شده باشد',
  standardBomIsRegisteredForProduct,
);

Given(
  'آنالیز استانداردی با کد MI {string} برای محصول {string} در سیستم ثبت شده باشد',
  standardBomIsRegisteredForProduct,
);

// سناریو: تعریف سفارش جدید / تعریف سفارش با چند کد MI / تعریف سفارش با کدهای MI دو محصول

When(
  '{actor} سفارش {string} را با کد MI {string} تعریف می کند',
  (actor: Actor, orderNumber: string, miCode: string) =>
    actor.attemptsTo(DefineOrder.using(orderNumber, [miCode])),
);

When(
  '{actor} سفارش {string} را با کدهای MI {string} و {string} تعریف می کند',
  (actor: Actor, orderNumber: string, first: string, second: string) =>
    actor.attemptsTo(DefineOrder.using(orderNumber, [first, second])),
);

const orderHoldsExactly = (orderNumber: string, miCodes: string[]) =>
  performAsAnObserverOtherThanTheActor(
    EnsureOrderHoldsExactly(orderNumber, miCodes),
  );

const orderHoldsExactlyOne = (orderNumber: string, miCode: string) =>
  orderHoldsExactly(orderNumber, [miCode]);

const orderHoldsExactlyTwo = (
  orderNumber: string,
  first: string,
  second: string,
) => orderHoldsExactly(orderNumber, [first, second]);

Then(
  'سفارش {string} با کد MI {string} در سیستم ثبت شده باشد',
  orderHoldsExactlyOne,
);

Then(
  'سفارش {string} با کدهای MI {string} و {string} در سیستم ثبت شده باشد',
  orderHoldsExactlyTwo,
);

Then(
  'سفارش {string} فقط با کد MI {string} در سیستم ثبت شده باشد',
  orderHoldsExactlyOne,
);

Then('سفارش {string} فقط کد MI {string} را داشته باشد', orderHoldsExactlyOne);

Then(
  'سفارش {string} کدهای MI {string} و {string} را داشته باشد',
  orderHoldsExactlyTwo,
);

Then(
  'سفارش {string} همچنان کدهای MI {string} و {string} را داشته باشد',
  orderHoldsExactlyTwo,
);

// قانون: فقط مدیریت و مدیر سیستم مجاز به تعریف، ویرایش یا حذف سفارش هستند

/** Every «تلاش …» on an order notes the orders first (as the observer), so «… ویرایش نشده باشد» and
 * «سفارش جدیدی ثبت نشده باشد» can say nothing changed; and records that it went over HTTP. */
const beforeAnAttemptOverHttp = async () => {
  triedThrough('api');
  theOrderWasChangedThrough('api');
  await performAsTheSystemAdmin(NoteTheOrders());
};

When(
  '{actor} تلاش می کند سفارش {string} را با کد MI {string} تعریف کند',
  async (actor: Actor, orderNumber: string, miCode: string) => {
    await beforeAnAttemptOverHttp();
    return actor.attemptsTo(DefineOrder.viaApiUsing(orderNumber, [miCode]));
  },
);

Then('سفارش {string} در سیستم ثبت نشده باشد', (orderNumber: string) =>
  performAsAnObserverOtherThanTheActor(EnsureOrderIsNotDefined(orderNumber)),
);

When(
  '{actor} تلاش می کند کد MI {string} را به سفارش {string} اضافه کند',
  async (actor: Actor, miCode: string, orderNumber: string) => {
    await beforeAnAttemptOverHttp();
    return actor.attemptsTo(AddMiCodeToOrder.viaApiUsing(miCode, orderNumber));
  },
);

When(
  '{actor} تلاش می کند سفارش {string} را حذف کند',
  async (actor: Actor, orderNumber: string) => {
    await beforeAnAttemptOverHttp();
    return actor.attemptsTo(DeleteOrder.viaApiUsing(orderNumber));
  },
);

Then('سفارش {string} از سیستم حذف نشده باشد', (orderNumber: string) =>
  performAsAnObserverOtherThanTheActor(EnsureOrderIsDefined(orderNumber)),
);

// قانون: شماره سفارش نمیتواند خالی باشد — the order form, through the browser. Its «اما شماره سفارش
// را خالی میگذارد» and «پیغام خطای شماره سفارش نشان داده شود» are step-definitions/common.steps.ts's,
// told apart from the daily-BOM form's by the flag set here.

When(
  '{actor} اطلاعات سفارش جدید با کد MI {string} وارد میکند',
  async (actor: Actor, miCode: string) => {
    theOrderNumberIsTypedInto('order');
    await performAsTheSystemAdmin(NoteTheOrders());
    return actor.attemptsTo(EnterNewOrderDetails(freshOrderNumber(), [miCode]));
  },
);

Then('سفارش جدیدی ثبت نشده باشد', () =>
  performAsAnObserverOtherThanTheActor(EnsureNoNewOrderWasDefined()),
);

// قانون: هر سفارش دست کم یک کد MI دارد

When(
  '{actor} تلاش می کند سفارش {string} را بدون هیچ کد MI تعریف کند',
  async (actor: Actor, orderNumber: string) => {
    await beforeAnAttemptOverHttp();
    return actor.attemptsTo(DefineOrder.viaApiUsing(orderNumber, []));
  },
);

Then('پیغام خطای نبود کد MI نشان داده شود', () =>
  actorInTheSpotlight().attemptsTo(EnsureToldAnOrderNeedsAnMiCode()),
);

// قانون: شماره سفارش یکتا است … — «… تلاش می کند سفارش … را با کد MI … تعریف کند» is above.

Then('پیغام خطای شماره سفارش تکراری نشان داده شود', () =>
  actorInTheSpotlight().attemptsTo(EnsureToldTheOrderNumberIsTaken()),
);

// قانون: یک کد MI بیش از یک بار به یک سفارش تخصیص داده نمی شود

When(
  '{actor} تلاش می کند کد MI {string} را دوباره به سفارش {string} اضافه کند',
  async (actor: Actor, miCode: string, orderNumber: string) => {
    await beforeAnAttemptOverHttp();
    return actor.attemptsTo(AddMiCodeToOrder.viaApiUsing(miCode, orderNumber));
  },
);

Then(
  'سفارش {string} فقط یک بار کد MI {string} را داشته باشد',
  (orderNumber: string, miCode: string) =>
    performAsAnObserverOtherThanTheActor(
      EnsureOrderHoldsMiCodeOnce(orderNumber, miCode),
    ),
);

Then('پیغام خطای کد MI تکراری در سفارش نشان داده شود', () =>
  actorInTheSpotlight().attemptsTo(EnsureToldTheMiCodeIsAlreadyAssigned()),
);

// قانون: فقط کدهای MI تعریف شده به سفارش تخصیص داده می شوند

Then('پیغام خطای کد MI تعریف نشده نشان داده شود', () =>
  actorInTheSpotlight().attemptsTo(EnsureToldTheMiCodeIsNotDefined()),
);

// قانون: به سفارشی که آنالیز روزانه دارد می شود کد MI افزود و آنالیزهای قبلی آن تغییری نمی کنند

Given(
  '{int} آنالیز روزانه برای سفارش {string} با کد MI {string} ثبت و توسط {actorName} تایید شده باشد',
  (count: number, orderNumber: string, miCode: string, approverName: string) =>
    dailyBomsAreRegisteredForOrder(count, orderNumber, miCode, approverName),
);

When(
  '{actor} کد MI {string} را به سفارش {string} اضافه می کند',
  (actor: Actor, miCode: string, orderNumber: string) =>
    actor.attemptsTo(AddMiCodeToOrder.using(miCode, orderNumber)),
);

Then(
  'هر {int} آنالیز روزانه سفارش {string} همچنان کد MI {string} و وضعیت {string} داشته باشند',
  (count: number, orderNumber: string, miCode: string, status: string) =>
    performAsAnObserverOtherThanTheActor(
      EnsureEveryDailyBomOfOrder(count, orderNumber, miCode, status),
    ),
);

// قانون: سفارشی که آنالیز روزانه دارد قابل ویرایش یا حذف نیست

When(
  '{actor} تلاش می کند شماره سفارش {string} را به {string} تغییر دهد',
  async (actor: Actor, orderNumber: string, newOrderNumber: string) => {
    await beforeAnAttemptOverHttp();
    return actor.attemptsTo(
      AttemptToEditOrder.changingItsNumber(orderNumber, newOrderNumber),
    );
  },
);

Then('سفارش {string} ویرایش نشده باشد', (orderNumber: string) =>
  performAsAnObserverOtherThanTheActor(EnsureOrderIsUnchanged(orderNumber)),
);

When(
  '{actor} تلاش می کند کد MI {string} را از سفارش {string} بردارد',
  async (actor: Actor, miCode: string, orderNumber: string) => {
    await beforeAnAttemptOverHttp();
    return actor.attemptsTo(
      AttemptToEditOrder.removingMiCode(miCode, orderNumber),
    );
  },
);

When(
  '{actor} شماره سفارش {string} را به {string} تغییر می دهد و کد MI {string} را از آن برمی دارد',
  (actor: Actor, orderNumber: string, newOrderNumber: string, miCode: string) =>
    actor.attemptsTo(
      EditOrder.using(orderNumber, {
        orderNumber: newOrderNumber,
        removedMiCodes: [miCode],
      }),
    ),
);

When(
  '{actor} سفارش {string} را حذف می کند',
  (actor: Actor, orderNumber: string) =>
    actor.attemptsTo(DeleteOrder.using(orderNumber)),
);

Then('سفارش {string} از سیستم حذف شده باشد', (orderNumber: string) =>
  performAsAnObserverOtherThanTheActor(EnsureOrderIsNotDefined(orderNumber)),
);

// قانون: مدیر سیستم شماره سفارشی را که آنالیز روزانه دارد اصلاح می کند …
//
// Through `/orders`' edit dialog and the correction confirmation. Onto a number another order
// already has, the site may refuse before it ever asks for the confirmation (the design does not
// pin which check runs first), so there the confirmation is given only if asked — told apart by the
// orders noted just before.

When(
  '{actor} شماره سفارش {string} را به {string} تغییر می دهد و اعمال آن در اطلاعات و سوابق مرتبط را تایید می کند',
  async (actor: Actor, orderNumber: string, newOrderNumber: string) => {
    theOrderWasChangedThrough('browser');
    await performAsTheSystemAdmin(NoteTheOrders());
    const taken = theOrdersNotedBeforeTheAttempt().some(
      (order) =>
        withLatinDigits(order.orderNumber) === withLatinDigits(newOrderNumber),
    );
    return actor.attemptsTo(
      taken
        ? CorrectOrderNumber.confirmingIfAsked(orderNumber, newOrderNumber)
        : CorrectOrderNumber.confirming(orderNumber, newOrderNumber),
    );
  },
);

When(
  '{actor} شماره سفارش {string} را به {string} تغییر می دهد اما اعمال آن در اطلاعات و سوابق مرتبط را تایید نمی کند',
  async (actor: Actor, orderNumber: string, newOrderNumber: string) => {
    theOrderWasChangedThrough('browser');
    await performAsTheSystemAdmin(NoteTheOrders());
    return actor.attemptsTo(
      CorrectOrderNumber.declining(orderNumber, newOrderNumber),
    );
  },
);

Then(
  'آن آنالیز روزانه همچنان شماره سفارش {string} را داشته باشد',
  (orderNumber: string) =>
    performAsAnObserverOtherThanTheActor(
      EnsureDailyBomHasOrderNumber(theLastRegisteredBom(), orderNumber),
    ),
);

// قانون: مدیر سیستم سفارشی را که آنالیز روزانه دارد همراه با همه آنالیزهای روزانه آن حذف می کند —
// «{actor} سفارش … را حذف می کند» is above.

Given(
  'اینکه {int} آنالیز روزانه برای سفارش {string} با کد MI {string} ثبت شده باشد',
  (count: number, orderNumber: string, miCode: string) =>
    dailyBomsAreRegisteredForOrder(count, orderNumber, miCode),
);

Then(
  'هیچ آنالیز روزانه ای با شماره سفارش {string} در سیستم نمانده باشد',
  (orderNumber: string) =>
    performAsAnObserverOtherThanTheActor(
      EnsureNoDailyBomHasOrderNumber(orderNumber),
    ),
);

// قانون: هر شماره سفارشی که پیش از تعریف سفارشات در آنالیزهای روزانه ثبت شده، یک بار و با همه کدهای
// MI آنالیزهایش در سفارشات دیده می شود — the two test-only endpoints
// (`screenplay/planning/legacy-orders.ts`).

Given(
  'اینکه پیش از تعریف سفارشات، آنالیزهای روزانه زیر ثبت شده باشند',
  (table: DataTable) =>
    legacyDailyBomsWereRegistered(
      table.hashes().map((row) => ({
        orderNumber: row['شماره سفارش'],
        trackingNumber: row['شماره ردیابی'],
        miCode: row['کد MI'],
        status: row['وضعیت'].trim(),
      })),
    ),
);

When('سفارشات آنالیزهای روزانه قبلی به سفارشات منتقل می شوند', () =>
  actorInTheSpotlight().attemptsTo(CarryOverLegacyOrders()),
);

Then('سفارشات زیر در سیستم ثبت شده باشند', (table: DataTable) =>
  performAsAnObserverOtherThanTheActor(
    EnsureTheOrdersAre(
      table.hashes().map((row) => ({
        orderNumber: row['شماره سفارش'],
        miCodes: row['کدهای MI'].split(',').map((code) => code.trim()),
      })),
    ),
  ),
);

Then(
  'شماره سفارش، شماره ردیابی، کد MI، وزن ها، وضعیت و جزئیات ویرایش هیچ یک از آنالیزهای روزانه قبلی تغییر نکرده باشد',
  () =>
    performAsAnObserverOtherThanTheActor(EnsureLegacyDailyBomsAreUnchanged()),
);
