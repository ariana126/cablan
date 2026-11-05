import { d, Question, QuestionAdapter, Task, Wait } from '@serenity-js/core';
import { Ensure, equals, isGreaterThan, isTrue } from '@serenity-js/assertions';
import { withLatinDigits } from '../common/persian-digits';
import {
  EnsureProblemDetail,
  EnsureValidationErrorFor,
} from '../common/problem-detail';
import { theOpenDialogShowsAnAlert } from '../common/dialog-answer';
import { theDoorTheOrderWasChangedThrough } from '../common/order-door-context';
import { OrdersPage } from '../ui/orders-page';
import {
  asSortedCodes,
  miCodesOf,
  OrderReadModel,
  pictureOf,
  Reader,
  readTheOrderNumbered,
  theOrdersNotedBeforeTheAttempt,
  TheOrders,
} from './order-details';

/**
 * What the system holds about orders (issue #101), read over the API — every `Then` here is
 * performed by the observer (`common/observer.ts#performAsTheSystemAdmin`), so the actor's own last
 * response survives for the «پیغام خطای …» / «به او گفته شود …» step that follows. Then the refusals
 * as the actor was told them.
 */

/** The order numbered `orderNumber` now, or `undefined` — read by the actor asking. */
const TheOrderNumbered = (
  orderNumber: string,
): QuestionAdapter<OrderReadModel | undefined> =>
  Question.about(d`order "${orderNumber}"`, (actor) =>
    readTheOrderNumbered(actor as Reader, orderNumber),
  );

const TheMiCodesOfTheOrderNumbered = (
  orderNumber: string,
): QuestionAdapter<string[] | undefined> =>
  Question.about(d`the MI codes of order "${orderNumber}"`, async (actor) => {
    const order = await actor.answer(TheOrderNumbered(orderNumber));
    return order ? miCodesOf(order) : undefined;
  });

/**
 * «سفارش … با کد(های) MI … در سیستم ثبت شده باشد», «… فقط با کد MI …», «… (فقط / همچنان) کد(های) MI
 * … را داشته باشد» — the order exists and holds exactly these MI codes, in any order.
 */
export const EnsureOrderHoldsExactly = (
  orderNumber: string,
  miCodes: string[],
): Task =>
  Task.where(
    d`#actor ensures order "${orderNumber}" holds exactly MI codes ${miCodes.join(', ')}`,
    Ensure.that(
      TheMiCodesOfTheOrderNumbered(orderNumber),
      equals<string[] | undefined>(asSortedCodes(miCodes)),
    ),
  );

/** «سفارش … فقط یک بار کد MI … را داشته باشد» */
export const EnsureOrderHoldsMiCodeOnce = (
  orderNumber: string,
  miCode: string,
): Task =>
  Task.where(
    d`#actor ensures order "${orderNumber}" holds MI code "${miCode}" once`,
    Ensure.that(
      Question.about(
        d`how often order "${orderNumber}" holds "${miCode}"`,
        async (actor) =>
          (
            (await actor.answer(TheMiCodesOfTheOrderNumbered(orderNumber))) ??
            []
          ).filter((held) => held === withLatinDigits(miCode)).length,
      ),
      equals(1),
    ),
  );

/** «سفارش … در سیستم ثبت نشده باشد» / «… از سیستم حذف شده باشد» */
export const EnsureOrderIsNotDefined = (orderNumber: string): Task =>
  Task.where(
    d`#actor ensures order "${orderNumber}" is not defined`,
    Ensure.that(
      Question.about(
        d`whether order "${orderNumber}" is defined`,
        async (actor) =>
          (await actor.answer(TheOrderNumbered(orderNumber))) !== undefined,
      ),
      equals(false),
    ),
  );

/** «سفارش … از سیستم حذف نشده باشد» */
export const EnsureOrderIsDefined = (orderNumber: string): Task =>
  Task.where(
    d`#actor ensures order "${orderNumber}" is defined`,
    Ensure.that(
      Question.about(
        d`whether order "${orderNumber}" is defined`,
        async (actor) =>
          (await actor.answer(TheOrderNumbered(orderNumber))) !== undefined,
      ),
      isTrue(),
    ),
  );

const TheOrdersNow = () =>
  Question.about('every order now, as number and MI codes', async (actor) =>
    (await actor.answer(TheOrders())).map(pictureOf).sort(byOrderNumber),
  );

const byOrderNumber = (
  a: { orderNumber: string },
  b: { orderNumber: string },
): number => a.orderNumber.localeCompare(b.orderNumber);

/**
 * «سفارش جدیدی ثبت نشده باشد» — every order is as it was noted before the attempt, and there is no
 * other: door-agnostic, so it holds after a refused API definition and a refused form alike.
 */
export const EnsureNoNewOrderWasDefined = (): Task =>
  Task.where(
    '#actor ensures no new order was defined',
    Ensure.that(
      TheOrdersNow(),
      equals(
        theOrdersNotedBeforeTheAttempt().map(pictureOf).sort(byOrderNumber),
      ),
    ),
  );

/** «سفارش … ویرایش نشده باشد» — the order is still there under its number, exactly as noted. */
export const EnsureOrderIsUnchanged = (orderNumber: string): Task =>
  Task.where(
    d`#actor ensures order "${orderNumber}" is unchanged`,
    Ensure.that(
      Question.about(d`order "${orderNumber}" now`, async (actor) => {
        const order = await actor.answer(TheOrderNumbered(orderNumber));
        return order ? pictureOf(order) : undefined;
      }),
      equals<ReturnType<typeof pictureOf> | undefined>(
        Question.about(d`order "${orderNumber}" as noted`, () => {
          const noted = theOrdersNotedBeforeTheAttempt().find(
            (order) =>
              withLatinDigits(order.orderNumber) ===
              withLatinDigits(orderNumber),
          );
          return noted ? pictureOf(noted) : undefined;
        }),
      ),
    ),
  );

/** «سفارشات زیر در سیستم ثبت شده باشند» — exactly these orders, each with exactly these codes. */
export const EnsureTheOrdersAre = (
  expected: { orderNumber: string; miCodes: string[] }[],
): Task =>
  Task.where(
    d`#actor ensures the orders are ${expected.map((order) => order.orderNumber).join(', ')}`,
    Ensure.that(
      TheOrdersNow(),
      equals(
        expected
          .map((order) => ({
            orderNumber: withLatinDigits(order.orderNumber),
            miCodes: asSortedCodes(order.miCodes),
          }))
          .sort(byOrderNumber),
      ),
    ),
  );

// ---------------------------------------------------------------------------------------------
// What the actor was told

/** «پیغام خطای شماره سفارش تکراری نشان داده شود» — read where the change was made
 * (`common/order-door-context.ts`): the 409, or the still-open edit dialog's alert. */
export const EnsureToldTheOrderNumberIsTaken = (): Task =>
  theDoorTheOrderWasChangedThrough() === 'browser'
    ? EnsureTheOrderDialogRefused('the order number is taken')
    : EnsureProblemDetail(409, 'order-number-taken');

/** «پیغام خطای نبود کد MI نشان داده شود» */
export const EnsureToldAnOrderNeedsAnMiCode = (): Task =>
  EnsureValidationErrorFor('miCodes');

/** «پیغام خطای کد MI تعریف نشده نشان داده شود» */
export const EnsureToldTheMiCodeIsNotDefined = (): Task =>
  EnsureProblemDetail(400, 'order-mi-code-not-found');

/** «پیغام خطای کد MI تکراری در سفارش نشان داده شود» */
export const EnsureToldTheMiCodeIsAlreadyAssigned = (): Task =>
  EnsureProblemDetail(409, 'order-mi-code-already-assigned');

/**
 * The order dialog is still open and says what was wrong — a field's `<mat-error>` or its alert
 * banner. Through the UI the suite asserts what the visitor sees, never a status code; the wording
 * is the frontend's to choose.
 */
const EnsureTheOrderDialogRefused = (what: string): Task =>
  Task.where(
    `#actor ensures the order dialog told them ${what}`,
    Wait.until(
      Question.about(
        'whether the order dialog shows an error',
        async (actor) =>
          (await actor.answer(OrdersPage.openDialogs().count())) > 0 &&
          ((await actor.answer(OrdersPage.formErrors().count())) > 0 ||
            (await theOpenDialogShowsAnAlert(actor))),
      ),
      isTrue(),
    ),
  );

/** «پیغام خطای شماره سفارش نشان داده شود» (in the order form) — its number field's error. */
export const EnsureOrderNumberErrorShownInTheOrderForm = (): Task =>
  Task.where(
    '#actor ensures the order form showed the order-number error',
    Wait.until(OrdersPage.formErrors().count(), isGreaterThan(0)),
  );
