import { actorCalled } from '@serenity-js/core';
import { Ensure, equals } from '@serenity-js/assertions';
import { GetRequest, LastResponse, Send } from '@serenity-js/rest';
import { LogInAsPersona } from '../common/personas';
import {
  approveDailyBomAsAPrecondition,
  EditDailyBom,
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
 * Test-data setup for `viewing-audit-log.feature`'s approval rule — "تغییر وضعیت تایید آنالیز
 * روزانه مانند تغییر سایر فیلدها در گزارش رویدادها ثبت می شود". Each example acts on the daily BOM
 * the background registered as row 8 (record id placeholder `77777777-…`) and then views one event
 * on it; each precondition below performs its mutation through the API, then finds the audit event
 * that mutation caused and makes it the one the following "جزئیات ... را مشاهده می کند" step
 * views — the same arrangement `audit-log-details.ts#registerMultiFieldEditFixture` uses for the
 * multi-field example.
 *
 * The background leaves the clock frozen at its last row's instant, so every event here shares
 * that instant: newest-first order cannot tell them apart, and each lookup instead asks for an
 * event of the expected action that did not exist before the mutation.
 */

/** The audit log is System-Admin-only, so events are looked up as یاشار. */
const theAdmin = async () => {
  const admin = actorCalled('یاشار');
  await admin.attemptsTo(LogInAsPersona('یاشار'));
  return admin;
};

/** "اینکه {مصطفی} آنالیز روزانه با شناسه رکورد «...» را تایید کرده باشد", and the approval half of
 * the other two examples' first precondition — targets the resulting `Approved` event. */
export const approveForTheAuditLog = async (
  placeholder: string,
  approverName: string,
): Promise<void> => {
  const id = theRealRecordIdFor(placeholder);
  await approveDailyBomAsAPrecondition(theDailyBomWithId(id), approverName);
  targetAuditEvent(
    await pollForANewAuditEventId(await theAdmin(), id, 'Approved'),
  );
};

/**
 * "اینکه آنالیز روزانه با شناسه رکورد «...» و شماره ردیابی «...» توسط «...» تایید شده باشد" — the
 * tracking number is part of what the step claims, and the change table that follows starts from
 * it, so it is confirmed rather than assumed: the background's row 9 is what set it, and if that
 * ever changes this fails here, naming the cause, instead of as a confusing mismatch three steps on.
 */
export const approveWithTrackingNumberForTheAuditLog = async (
  placeholder: string,
  trackingNumber: string,
  approverName: string,
): Promise<void> => {
  const id = theRealRecordIdFor(placeholder);
  const admin = await theAdmin();
  await admin.attemptsTo(
    Send.a(GetRequest.to(`boms/${id}`)),
    Ensure.that(LastResponse.status(), equals(200)),
    Ensure.that(
      LastResponse.body<{ trackingNumber: string }>().trackingNumber,
      equals(trackingNumber),
    ),
  );
  await approveForTheAuditLog(placeholder, approverName);
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

/** "{نیکروش} شماره ردیابی آن را به «...» تغییر داده باشد" — targets the resulting `Edited` event,
 * not row 9's earlier edit of the same daily BOM. */
export const changeTrackingNumberForTheAuditLog = async (
  editorName: string,
  trackingNumber: string,
): Promise<void> => {
  const id = theIdOfThatDailyBom();
  const earlierEvents = await auditEventIdsFor(await theAdmin(), id);
  await actorCalled(editorName).attemptsTo(
    LogInAsPersona(editorName),
    EditDailyBom.changingTrackingNumberViaApi(thatDailyBom(), trackingNumber),
  );
  targetAuditEvent(
    await pollForANewAuditEventId(
      await theAdmin(),
      id,
      'Edited',
      earlierEvents,
    ),
  );
};
