import { actorCalled, Question, QuestionAdapter } from '@serenity-js/core';
import { Ensure, equals } from '@serenity-js/assertions';
import { GetRequest, LastResponse, Send } from '@serenity-js/rest';
import { LogInAsPersona } from '../common/personas';
import {
  ApprovalStatus,
  approveDailyBomAsAPrecondition,
  EditDailyBom,
  focusOnTheDailyBomWithId,
  rejectDailyBomAsAPrecondition,
  thatDailyBom,
  theDailyBomWithId,
  theIdOfThatDailyBom,
} from '../bom-analyzing/daily-bom-approval';
import {
  freshMaterialInComponent,
  freshProductDetails,
  theLastRegisteredProduct,
} from '../bom-registration/product-details';
import { RegisterProductAndRememberIt } from '../bom-registration/register-product';
import { RegisterStandardBomAndRememberIt } from '../bom-registration/register-standard-bom';
import { theLastRegisteredStandardBom } from '../bom-registration/standard-bom-details';
import { RegisterBomAndRememberIt } from '../bom-registration/register-bom';
import { theLastRegisteredBom } from '../bom-registration/bom-details';
import {
  rebindRecordIdPlaceholder,
  theRealRecordIdFor,
} from './audit-log-fixtures';
import {
  auditEventIdsFor,
  pollForANewAuditEventId,
  targetAuditEvent,
} from './audit-log-details';
import { AuditAction } from './view-audit-log';

/**
 * Test-data setup for `viewing-audit-log.feature`'s three review rules — "تغییر وضعیت تایید آنالیز
 * روزانه مانند تغییر سایر فیلدها در گزارش رویدادها ثبت می شود", "ویرایش و سپس تایید توسط مدیریت، به
 * صورت دو رویداد جداگانه ویرایش و تایید ثبت می شود" and "بازگشت به در انتظار تایید در اثر ویرایش، به
 * صورت یک رویداد جداگانه پس از رویداد ویرایش ثبت می شود".
 *
 * Most examples act on the daily BOM the background registered as row 8 (record id placeholder
 * `77777777-…`). Each precondition performs its change through the API; the ones that a
 * "جزئیات ... را مشاهده می کند" step follows target the audit event the change caused, the same
 * arrangement `audit-log-details.ts#registerMultiFieldEditFixture` uses for the multi-field example.
 *
 * **Naming "رویداد ویرایش", "رویداد تایید", "رویداد بازگشت به در انتظار تایید".** The edit rules'
 * `Then`s name an event by its kind. The precondition just before the change takes a *baseline* —
 * every event the daily BOM already had — and each named event is the one of that kind recorded
 * since (`theNewAuditEventOf`). That is what tells it from an older one of the same kind (row 9 is
 * an earlier edit of the same daily BOM), and lets the shared edit-then-approve precondition
 * (`step-definitions/common.steps.ts`) stay ignorant of the audit log altogether.
 *
 * The background leaves the clock frozen at its last row's instant, so every event here shares
 * that instant. The backend breaks such ties in the list (newest recorded first), and the edit
 * rules assert exactly that order; the lookups here do not lean on it.
 */

/** The audit log is System-Admin-only, so events are looked up as یاشار. */
const theAdmin = async () => {
  const admin = actorCalled('یاشار');
  await admin.attemptsTo(LogInAsPersona('یاشار'));
  return admin;
};

/**
 * The daily BOM a precondition names, as `GET boms/:id` reports it — confirmed rather than assumed:
 * the background's row 9 is what set the tracking number, and if that ever changes this fails
 * here, naming the cause, instead of as a confusing mismatch three steps on.
 */
const confirmTheDailyBom = async (
  id: string,
  expected: { trackingNumber: string; approvalStatus?: ApprovalStatus },
): Promise<void> => {
  const admin = await theAdmin();
  await admin.attemptsTo(
    Send.a(GetRequest.to(`boms/${id}`)),
    Ensure.that(LastResponse.status(), equals(200)),
    Ensure.that(
      LastResponse.body<{ trackingNumber: string }>().trackingNumber,
      equals(expected.trackingNumber),
    ),
  );
  if (expected.approvalStatus) {
    await admin.attemptsTo(
      Ensure.that(
        LastResponse.body<{ approvalStatus: ApprovalStatus }>().approvalStatus,
        equals(expected.approvalStatus),
      ),
    );
  }
};

interface Baseline {
  recordId: string;
  /** Every event recorded for the daily BOM when the baseline was taken. */
  eventsBefore: string[];
}

let baseline: Baseline | undefined;

/** Takes the baseline the event lookups below compare against — just before the change. */
const takeTheBaselineOf = async (recordId: string): Promise<void> => {
  baseline = {
    recordId,
    eventsBefore: await auditEventIdsFor(await theAdmin(), recordId),
  };
};

const theBaseline = (): Baseline => {
  if (!baseline) {
    throw new Error(
      'No audit baseline has been taken yet — expected a preceding "... شماره ردیابی آن را به ' +
        '«...» تغییر داده باشد" or "آنالیز روزانه در انتظار تایید ... که وزن ... است ..." step.',
    );
  }
  return baseline;
};

/**
 * "اینکه {مصطفی} آنالیز روزانه با شناسه رکورد «...» و شماره ردیابی «...» را تایید کرده باشد" and
 * "اینکه آنالیز روزانه با شناسه رکورد «...» و شماره ردیابی «...» توسط «...» تایید شده باشد" —
 * confirms the tracking number the step claims, approves, and targets the resulting `Approved`
 * event.
 */
export const approveWithTrackingNumberForTheAuditLog = async (
  placeholder: string,
  trackingNumber: string,
  approverName: string,
): Promise<void> => {
  const id = theRealRecordIdFor(placeholder);
  await confirmTheDailyBom(id, { trackingNumber });
  await approveDailyBomAsAPrecondition(theDailyBomWithId(id), approverName);
  targetAuditEvent(
    await pollForANewAuditEventId(await theAdmin(), id, 'Approved'),
  );
};

/**
 * "اینکه {مصطفی} آنالیز روزانه با شناسه رکورد «...» و شماره ردیابی «...» را با دلیل «...» عدم تایید
 * کرده باشد" and "اینکه آنالیز روزانه با شناسه رکورد «...» و شماره ردیابی «...» توسط «...» با دلیل
 * «...» عدم تایید شده باشد" — confirms the tracking number the step claims, rejects, and targets
 * the resulting `Rejected` event.
 */
export const rejectWithTrackingNumberForTheAuditLog = async (
  placeholder: string,
  trackingNumber: string,
  reviewerName: string,
  reason: string,
): Promise<void> => {
  const id = theRealRecordIdFor(placeholder);
  await confirmTheDailyBom(id, { trackingNumber });
  await rejectDailyBomAsAPrecondition(
    theDailyBomWithId(id),
    reviewerName,
    reason,
  );
  targetAuditEvent(
    await pollForANewAuditEventId(await theAdmin(), id, 'Rejected'),
  );
};

/**
 * "اینکه آنالیز روزانه در انتظار تایید با شناسه رکورد «...» و شماره ردیابی «...» در سیستم ثبت شده
 * باشد" — the background registered it; this confirms both facts the step claims and brings it
 * into focus for the edit that follows. Nothing is mutated.
 */
export const confirmPendingDailyBomForTheAuditLog = async (
  placeholder: string,
  trackingNumber: string,
): Promise<void> => {
  const id = theRealRecordIdFor(placeholder);
  await confirmTheDailyBom(id, { trackingNumber, approvalStatus: 'pending' });
  focusOnTheDailyBomWithId(id);
};

/**
 * "اینکه آنالیز روزانه در انتظار تایید با شناسه رکورد «...» که وزن مواد اولیه «...» جز «...» آن «...»
 * است در سیستم ثبت شده باشد" — the background's row 8 daily BOM is composed of a throwaway component
 * and material (row 3's product must not name «مغزی»/«مسی», which rows 4 and 5 register — see
 * `audit-log-fixtures.ts`), and a daily BOM's composition is checked against its standard BOM, so no
 * edit can give it the line this step names. So this registers a daily BOM that has it: a fresh
 * product composed of that one line (reusing the component and material rows 4 and 5 registered),
 * its standard BOM, and the daily BOM with that weight, registered by the inspector نیکروش. The
 * step's record id placeholder is then bound to it, so the steps after it that name the
 * placeholder — the list filter — find this daily BOM. Brought into focus, with the baseline its
 * event lookups need.
 */
export const registerPendingDailyBomWithWeightForTheAuditLog = async (
  placeholder: string,
  componentName: string,
  materialName: string,
  weight: number,
): Promise<void> => {
  const admin = await theAdmin();
  await admin.attemptsTo(
    RegisterProductAndRememberIt(
      freshProductDetails({
        components: [
          {
            name: componentName,
            materials: [freshMaterialInComponent({ name: materialName })],
          },
        ],
      }),
    ),
  );
  await admin.attemptsTo(
    RegisterStandardBomAndRememberIt(theLastRegisteredProduct()),
  );
  const inspector = actorCalled('نیکروش');
  await inspector.attemptsTo(
    LogInAsPersona('نیکروش'),
    // The standard BOM has exactly the one line, so every line gets `weight`.
    RegisterBomAndRememberIt(theLastRegisteredStandardBom(), {}, () => weight),
  );
  const { id } = theLastRegisteredBom();
  rebindRecordIdPlaceholder(placeholder, id);
  await confirmTheDailyBom(id, {
    trackingNumber: theLastRegisteredBom().trackingNumber,
    approvalStatus: 'pending',
  });
  focusOnTheDailyBomWithId(id);
  await takeTheBaselineOf(id);
};

/** "{نیکروش} شماره ردیابی آن را به «...» تغییر داده باشد" — takes the baseline, then edits. Does not
 * look for a return to pending: whether the edit caused one is what the scenario asserts. */
export const changeTrackingNumberForTheAuditLog = async (
  editorName: string,
  trackingNumber: string,
): Promise<void> => {
  await takeTheBaselineOf(theIdOfThatDailyBom());
  await actorCalled(editorName).attemptsTo(
    LogInAsPersona(editorName),
    EditDailyBom.changingTrackingNumberViaApi(thatDailyBom(), trackingNumber),
  );
};

/** The event of `action` recorded for the baseline's daily BOM since the baseline, looked up when
 * a step asks for it (as the System Admin, since only they may read the log) — polled, since audit
 * projection is fire-and-forget (`audit-log-details.ts#pollForANewAuditEventId`). */
const theNewAuditEventOf = (
  action: AuditAction,
  description: string,
): QuestionAdapter<string> =>
  Question.about(description, async () => {
    const { recordId, eventsBefore } = theBaseline();
    return pollForANewAuditEventId(
      await theAdmin(),
      recordId,
      action,
      eventsBefore,
    );
  });

/** "رویداد ویرایش" — the `Edited` event the edit precondition caused. */
export const theAuditEventOfTheEdit = (): QuestionAdapter<string> =>
  theNewAuditEventOf('Edited', 'the audit event of the edit');

/** "رویداد تایید" in the edit-then-approve rule — the `Approved` event that followed the edit. */
export const theAuditEventOfTheApproval = (): QuestionAdapter<string> =>
  theNewAuditEventOf('Approved', 'the audit event of the approval');

/** "رویداد بازگشت به در انتظار تایید" — the `ReturnedToPending` event the edit caused. */
export const theReturnToPendingCausedByTheEdit = (): QuestionAdapter<string> =>
  theNewAuditEventOf(
    'ReturnedToPending',
    'the return to pending the edit caused',
  );
