import { HttpErrorResponse } from '@angular/common/http';
import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { form } from '@angular/forms/signals';
import { describe, expect, it } from 'vitest';

import { PROBLEM } from '../../core/http/problem-details';
import {
  mapQcRecordError,
  NOTES_TOO_LONG,
  TRACKING_NUMBER_MAX_LENGTH,
  TRACKING_NUMBER_REQUIRED,
  TRACKING_NUMBER_TOO_LONG,
} from './server-errors';

const refusedField = (field: string) =>
  new HttpErrorResponse({
    status: 400,
    error: { type: PROBLEM.validationError, status: 400, errors: [{ field }] },
  });

function messagesFor(error: unknown, trackingNumber: string): (string | undefined)[] {
  return TestBed.runInInjectionContext(() => {
    const recordForm = form(signal({ trackingNumber, notes: '' }));
    return mapQcRecordError(error, recordForm).map((each) => each.message);
  });
}

describe('mapQcRecordError', () => {
  it('reads the API’s refusal of a blank tracking number as a missing one', () => {
    expect(messagesFor(refusedField('trackingNumber'), ' ')).toEqual([TRACKING_NUMBER_REQUIRED]);
  });

  it('reads the API’s refusal of an overlong tracking number as too long, not as missing', () => {
    expect(
      messagesFor(refusedField('trackingNumber'), 'T'.repeat(TRACKING_NUMBER_MAX_LENGTH + 1)),
    ).toEqual([TRACKING_NUMBER_TOO_LONG]);
    expect(TRACKING_NUMBER_TOO_LONG).toBe('شماره ردیابی حداکثر ۱۰۰ نویسه است.');
  });

  it('puts the refusal of the notes on the notes', () => {
    expect(messagesFor(refusedField('notes'), 'TR-1')).toEqual([NOTES_TOO_LONG]);
  });
});
