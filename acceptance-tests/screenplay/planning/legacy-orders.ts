import { d, Interaction, Question, Task } from '@serenity-js/core';
import { Ensure, equals } from '@serenity-js/assertions';
import { GetRequest, LastResponse, PostRequest, Send } from '@serenity-js/rest';
import { performAsTheSystemAdmin } from '../common/observer';
import { RegisterStandardBomWithMiCodeUnlessRegistered } from '../bom-registration/register-standard-bom';
import { theStandardBomRegisteredWithMiCode } from '../bom-registration/standard-bom-details';
import { RegisterLegacyBomAndRememberIt } from '../bom-registration/register-bom';
import { theLastRegisteredBom } from '../bom-registration/bom-details';
import {
  approvalStatusFor,
  approveDailyBomAsAPrecondition,
  focusOnTheDailyBom,
  rejectDailyBomAsAPrecondition,
  thatDailyBom,
} from '../bom-analyzing/daily-bom-approval';

/**
 * The carry-over of issue #101: every order number the daily BOMs used before orders existed
 * becomes an order, once, with every MI code its daily BOMs were registered with — and no daily BOM
 * changes. On the test stack only, two endpoints make that observable (pinned contract):
 * `POST testing/boms/legacy-daily-boms` registers a daily BOM bypassing the order rule
 * (`register-bom.ts#RegisterLegacyBomAndRememberIt`), and `POST testing/boms/order-backfill` (204,
 * idempotent) runs the same carry-over the migration does.
 */

export interface LegacyDailyBom {
  orderNumber: string;
  trackingNumber: string;
  miCode: string;
  /** «تایید» / «عدم تایید» / «در انتظار تایید» */
  status: string;
}

/** What «… تغییر نکرده باشد» compares: the daily BOM as `GET boms/:id` reports these fields. */
interface LegacyDailyBomPicture {
  orderNumber: string;
  trackingNumber: string;
  standardBomId: string;
  standardBomMiCode: string;
  components: unknown;
  approvalStatus: string;
  editHistory: unknown;
}

const REVIEWER = 'مصطفی';
const ROUTINE_REJECTION_REASON = 'نمونه با استاندارد مطابقت ندارد';

let legacyDailyBomIds: string[] = [];
let legacyDailyBomsBeforeTheCarryOver: LegacyDailyBomPicture[] = [];

const pictureOf = (body: LegacyDailyBomPicture): LegacyDailyBomPicture => ({
  orderNumber: body.orderNumber,
  trackingNumber: body.trackingNumber,
  standardBomId: body.standardBomId,
  standardBomMiCode: body.standardBomMiCode,
  components: body.components,
  approvalStatus: body.approvalStatus,
  editHistory: body.editHistory,
});

const TheLegacyDailyBomsNow = () =>
  Question.about('the legacy daily BOMs now', async (actor) => {
    const pictures: LegacyDailyBomPicture[] = [];
    for (const id of legacyDailyBomIds) {
      await Send.a(GetRequest.to(`boms/${id}`)).performAs(actor);
      pictures.push(
        pictureOf(
          await actor.answer(LastResponse.body<LegacyDailyBomPicture>()),
        ),
      );
    }
    return pictures;
  });

const NoteTheLegacyDailyBoms = (): Interaction =>
  Interaction.where('#actor notes the legacy daily BOMs', async (actor) => {
    legacyDailyBomsBeforeTheCarryOver = await actor.answer(
      TheLegacyDailyBomsNow(),
    );
  });

/**
 * «اینکه پیش از تعریف سفارشات، آنالیزهای روزانه زیر ثبت شده باشند» — each row registered by the
 * System Admin through the legacy door on its MI code's standard BOM (registered unless it is),
 * then reviewed by مصطفی into the row's status, and finally all of them noted as they are.
 */
export const legacyDailyBomsWereRegistered = async (
  rows: LegacyDailyBom[],
): Promise<void> => {
  legacyDailyBomIds = [];
  for (const row of rows) {
    await performAsTheSystemAdmin(
      RegisterStandardBomWithMiCodeUnlessRegistered(row.miCode),
    );
    await performAsTheSystemAdmin(
      RegisterLegacyBomAndRememberIt(
        theStandardBomRegisteredWithMiCode(row.miCode),
        { orderNumber: row.orderNumber, trackingNumber: row.trackingNumber },
      ),
    );
    const bom = theLastRegisteredBom();
    legacyDailyBomIds.push(bom.id);
    focusOnTheDailyBom(bom);
    switch (approvalStatusFor(row.status)) {
      case 'approved':
        await approveDailyBomAsAPrecondition(thatDailyBom(), REVIEWER);
        break;
      case 'rejected':
        await rejectDailyBomAsAPrecondition(
          thatDailyBom(),
          REVIEWER,
          ROUTINE_REJECTION_REASON,
        );
        break;
      default:
        break;
    }
  }
  await performAsTheSystemAdmin(NoteTheLegacyDailyBoms());
};

/** «سفارشات آنالیزهای روزانه قبلی به سفارشات منتقل می شوند» — the carry-over, as the migration
 * runs it. The testing endpoint takes no auth. */
export const CarryOverLegacyOrders = (): Task =>
  Task.where(
    '#actor carries the legacy daily BOMs’ order numbers over into orders',
    Send.a(PostRequest.to('testing/boms/order-backfill')),
    Ensure.that(LastResponse.status(), equals(204)),
  );

/** «شماره سفارش، شماره ردیابی، کد MI، وزن ها، وضعیت و جزئیات ویرایش هیچ یک از آنالیزهای روزانه قبلی
 * تغییر نکرده باشد» */
export const EnsureLegacyDailyBomsAreUnchanged = (): Task =>
  Task.where(
    d`#actor ensures none of the ${legacyDailyBomIds.length} legacy daily BOMs changed`,
    Ensure.that(
      TheLegacyDailyBomsNow(),
      equals(legacyDailyBomsBeforeTheCarryOver),
    ),
  );
