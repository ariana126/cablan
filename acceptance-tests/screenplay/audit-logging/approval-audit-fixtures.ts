import {
  actorCalled,
  Answerable,
  Question,
  QuestionAdapter,
} from '@serenity-js/core';
import { Ensure, equals } from '@serenity-js/assertions';
import { GetRequest, LastResponse, Send } from '@serenity-js/rest';
import { LogInAsPersona } from '../common/personas';
import {
  ApprovalStatus,
  approveDailyBomAsAPrecondition,
  EditDailyBom,
  focusOnTheDailyBomWithId,
  RevokeDailyBomApproval,
  thatDailyBom,
  theDailyBomWithId,
  theIdOfThatDailyBom,
} from '../bom-analyzing/daily-bom-approval';
import { theRealRecordIdFor } from './audit-log-fixtures';
import {
  auditEventIdsFor,
  pollForANewAuditEventId,
  targetAuditEvent,
} from './audit-log-details';

/**
 * Test-data setup for `viewing-audit-log.feature`'s two approval rules — "تغییر وضعیت تایید آنالیز
 * روزانه مانند تغییر سایر فیلدها در گزارش رویدادها ثبت می شود" and "لغو تایید در اثر ویرایش، به
 * صورت یک رویداد لغو تایید جداگانه پس از رویداد ویرایش ثبت می شود". Each example acts on the daily BOM
 * the background registered as row 8 (record id placeholder `77777777-…`) and then views one event
 * on it; each precondition below performs its mutation through the API, then finds the audit event
 * that mutation caused and makes it the one the following "جزئیات ... را مشاهده می کند" step
 * views — the same arrangement `audit-log-details.ts#registerMultiFieldEditFixture` uses for the
 * multi-field example.
 *
 * The background leaves the clock frozen at its last row's instant, so every event here shares
 * that instant. The backend breaks such ties in the list (newest recorded first), and the edit
 * rule asserts exactly that order; the lookups here do not lean on it, and instead ask for an
 * event of the expected action that did not exist before the mutation.
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
 * "اینکه آنالیز روزانه تایید نشده ای با شناسه رکورد «...» و شماره ردیابی «...» در سیستم ثبت شده
 * باشد" — the background registered it; this confirms both facts the step claims and brings it
 * into focus for the edit that follows. Nothing is mutated.
 */
export const confirmUnapprovedDailyBomForTheAuditLog = async (
  placeholder: string,
  trackingNumber: string,
): Promise<void> => {
  const id = theRealRecordIdFor(placeholder);
  await confirmTheDailyBom(id, {
    trackingNumber,
    approvalStatus: 'unapproved',
  });
  focusOnTheDailyBomWithId(id);
};

/** "{مصطفی} تایید آن را لغو کرده باشد" — targets the resulting `ApprovalRevoked` event. */
export const revokeForTheAuditLog = async (
  actorName: string,
): Promise<void> => {
  const id = theIdOfThatDailyBom();
  await actorCalled(actorName).attemptsTo(
    LogInAsPersona(actorName),
    RevokeDailyBomApproval.viaApi(thatDailyBom()),
  );
  targetAuditEvent(
    await pollForANewAuditEventId(await theAdmin(), id, 'ApprovalRevoked'),
  );
};

interface EditInTheLog {
  recordId: string;
  /** Every event recorded for the daily BOM before the edit — what tells the events the edit
   * caused from older ones of the same kind (row 9 is an earlier edit of the same daily BOM). */
  eventsBefore: string[];
  editEventId: string;
}

let lastEdit: EditInTheLog | undefined;

const theLastEdit = (): EditInTheLog => {
  if (!lastEdit) {
    throw new Error(
      'No daily BOM edit has been recorded yet — expected a preceding "... شماره ردیابی آن را به ' +
        '«...» تغییر داده باشد" step.',
    );
  }
  return lastEdit;
};

/** "{نیکروش} شماره ردیابی آن را به «...» تغییر داده باشد" — remembers the resulting `Edited` event
 * (not row 9's earlier edit of the same daily BOM) and what the log held before it. Does not look
 * for a revocation: whether the edit caused one is what the scenario asserts. */
export const changeTrackingNumberForTheAuditLog = async (
  editorName: string,
  trackingNumber: string,
): Promise<void> => {
  const id = theIdOfThatDailyBom();
  const eventsBefore = await auditEventIdsFor(await theAdmin(), id);
  await actorCalled(editorName).attemptsTo(
    LogInAsPersona(editorName),
    EditDailyBom.changingTrackingNumberViaApi(thatDailyBom(), trackingNumber),
  );
  lastEdit = {
    recordId: id,
    eventsBefore,
    editEventId: await pollForANewAuditEventId(
      await theAdmin(),
      id,
      'Edited',
      eventsBefore,
    ),
  };
};

/** "رویداد ویرایش" — the `Edited` event the edit precondition caused. */
export const theAuditEventOfTheEdit = (): Answerable<string> =>
  theLastEdit().editEventId;

/** "رویداد لغو تایید" in the edit rule — the `ApprovalRevoked` event the edit caused, looked up when
 * the step asks for it (as the System Admin, since only they may read the log). */
export const theApprovalRevocationCausedByTheEdit =
  (): QuestionAdapter<string> =>
    Question.about('the approval revocation the edit caused', async () => {
      const { recordId, eventsBefore } = theLastEdit();
      return pollForANewAuditEventId(
        await theAdmin(),
        recordId,
        'ApprovalRevoked',
        eventsBefore,
      );
    });
