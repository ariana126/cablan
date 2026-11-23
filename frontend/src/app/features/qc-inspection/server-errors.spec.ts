import { HttpErrorResponse } from '@angular/common/http';
import { describe, expect, it } from 'vitest';

import { PROBLEM } from '../../core/http/problem-details';
import {
  qcRefusalReason,
  qcSubmissionFailureOf,
  TRACKING_NUMBER_MAX_LENGTH,
  TRACKING_NUMBER_REQUIRED,
  TRACKING_NUMBER_TOO_LONG,
} from './server-errors';

const EQUIPMENT = 'اکسترودر 1';

const problem = (status: number, type: string, extra: object = {}) =>
  new HttpErrorResponse({ status, error: { type, status, ...extra } });

const refusedField = (field: string) =>
  problem(400, PROBLEM.validationError, { errors: [{ field }] });

const failureOf = (error: unknown, trackingNumber = 'TR-100') =>
  qcSubmissionFailureOf(error, { equipmentName: EQUIPMENT, trackingNumber });

describe('qcSubmissionFailureOf', () => {
  it('reads an answer that never came as one to send again', () => {
    expect(failureOf(new HttpErrorResponse({ status: 0 }))).toEqual({
      kind: 'unanswered',
      message: 'پاسخ ثبت از سرور نرسید.',
      detail:
        'ممکن است برخی فعالیت‌ها ثبت شده باشند. «ارسال دوباره» بی‌خطر است: همین ثبت دوباره فرستاده می‌شود و هیچ فعالیتی دو بار ثبت نمی‌شود.',
    });
  });

  it('reads a server failure as one to send again', () => {
    expect(failureOf(problem(500, 'about:blank')).kind).toBe('unanswered');
    expect(failureOf(new HttpErrorResponse({ status: 502 })).kind).toBe('unanswered');
  });

  it('puts a refused tracking number on its field, missing or too long by what was sent', () => {
    expect(failureOf(refusedField('trackingNumber'), '  ')).toEqual({
      kind: 'invalid',
      message: TRACKING_NUMBER_REQUIRED,
    });
    expect(
      failureOf(refusedField('trackingNumber'), 'x'.repeat(TRACKING_NUMBER_MAX_LENGTH + 1)),
    ).toEqual({ kind: 'invalid', message: TRACKING_NUMBER_TOO_LONG });
  });

  it('refuses the whole submission for any other invalid part', () => {
    expect(failureOf(refusedField('activities'))).toEqual({
      kind: 'refused',
      message: 'ثبت پذیرفته نشد؛ فعالیت‌های انتخاب‌شده یا توضیحات آن‌ها را بررسی کنید.',
    });
  });

  it('names the equipment when it has been retired', () => {
    expect(failureOf(problem(409, PROBLEM.equipmentRetired))).toEqual({
      kind: 'refused',
      message: '«اکسترودر 1» کنار گذاشته شده است؛ ثبت انجام ممکن نیست.',
    });
  });

  it('says a submission sent before with other details cannot be sent again', () => {
    expect(failureOf(problem(409, PROBLEM.qcSubmissionMismatch))).toEqual({
      kind: 'refused',
      message: 'این ثبت پیش از این برای تجهیز، بازرس یا شماره ردیابی دیگری فرستاده شده است.',
    });
  });

  it('says so when the equipment no longer exists', () => {
    expect(failureOf(problem(404, PROBLEM.equipmentNotFound))).toEqual({
      kind: 'refused',
      message: 'این تجهیز دیگر وجود ندارد.',
    });
  });

  it('says the role may not record, matched by status', () => {
    expect(failureOf(new HttpErrorResponse({ status: 403 }))).toEqual({
      kind: 'refused',
      message: 'شما اجازهٔ ثبت انجام فعالیت QC را ندارید.',
    });
  });

  it('falls back to a general refusal for anything else', () => {
    expect(failureOf(problem(409, 'https://my-api-doc.dev/problems/something-new'))).toEqual({
      kind: 'refused',
      message: 'خطایی غیرمنتظره رخ داد. دوباره تلاش کنید.',
    });
  });
});

describe('qcRefusalReason', () => {
  it('names the activity and the equipment when the activity is not assigned', () => {
    expect(qcRefusalReason('qc-activity-not-assigned', 'بازرسی ظاهری', EQUIPMENT)).toBe(
      '"بازرسی ظاهری" به "اکسترودر 1" تخصیص داده نشده است.',
    );
  });

  it('says the activity no longer exists', () => {
    expect(qcRefusalReason('qc-activity-not-found', 'بازرسی ظاهری', EQUIPMENT)).toBe(
      'این فعالیت QC دیگر وجود ندارد.',
    );
  });
});
