import { HttpErrorResponse } from '@angular/common/http';
import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { form } from '@angular/forms/signals';
import { describe, expect, it } from 'vitest';

import { PROBLEM } from '../../core/http/problem-details';
import {
  mapQcActivityFormError,
  QC_ACTIVITY_NAME_MAX_LENGTH,
  QC_ACTIVITY_NAME_REQUIRED,
  QC_ACTIVITY_NAME_TOO_LONG,
} from './server-errors';

const validationError = new HttpErrorResponse({
  status: 400,
  error: { type: PROBLEM.validationError, status: 400, errors: [{ field: 'name' }] },
});

function messagesFor(name: string): (string | undefined)[] {
  return TestBed.runInInjectionContext(() => {
    const activityForm = form(signal({ name }));
    return mapQcActivityFormError(validationError, activityForm).map((error) => error.message);
  });
}

describe('mapQcActivityFormError', () => {
  it('reads the API’s refusal of a blank title as a missing one', () => {
    expect(messagesFor('   ')).toEqual([QC_ACTIVITY_NAME_REQUIRED]);
  });

  it('reads the API’s refusal of an overlong title as too long, not as missing', () => {
    expect(messagesFor('ب'.repeat(QC_ACTIVITY_NAME_MAX_LENGTH + 1))).toEqual([
      QC_ACTIVITY_NAME_TOO_LONG,
    ]);
    expect(QC_ACTIVITY_NAME_TOO_LONG).toBe('عنوان فعالیت حداکثر ۲۰۰ نویسه است.');
  });
});
