import { HttpErrorResponse } from '@angular/common/http';
import { describe, expect, it } from 'vitest';

import { PROBLEM } from './problem-details';
import {
  correctionConfirmationMessage,
  RecordDependents,
  recordHasDependentsMessage,
} from './record-has-dependents';

function refusal(dependents: readonly RecordDependents[]): HttpErrorResponse {
  return new HttpErrorResponse({
    status: 409,
    url: '/api/materials/1',
    error: {
      type: PROBLEM.recordHasDependents,
      title: 'Record has dependents',
      status: 409,
      detail: 'Material 1 cannot be edited or deleted: it is referenced by 1 product.',
      recordType: 'Material',
      dependents,
    },
  });
}

describe('recordHasDependentsMessage', () => {
  it('names the one product a refused delete is used in, its count in Persian digits', () => {
    const message = recordHasDependentsMessage(
      refusal([{ kind: 'product', count: 1, names: ['کابل NYY'] }]),
      'delete',
    );

    expect(message).toBe(
      'امکان حذف این اطلاعات وجود ندارد، زیرا در ۱ محصول («کابل NYY») استفاده شده است.',
    );
  });

  it('says ویرایش for a refused edit', () => {
    const message = recordHasDependentsMessage(
      refusal([{ kind: 'product', count: 1, names: ['کابل NYY'] }]),
      'edit',
    );

    expect(message).toBe(
      'امکان ویرایش این اطلاعات وجود ندارد، زیرا در ۱ محصول («کابل NYY») استفاده شده است.',
    );
  });

  it('joins several names of one kind with a Persian comma', () => {
    const message = recordHasDependentsMessage(
      refusal([{ kind: 'standard-bom', count: 2, names: ['MI-100', 'MI-200'] }]),
      'delete',
    );

    expect(message).toBe(
      'امکان حذف این اطلاعات وجود ندارد، زیرا در ۲ آنالیز استاندارد («MI-100، MI-200») استفاده شده است.',
    );
  });

  it('joins several kinds with و, in the order the API lists them', () => {
    const message = recordHasDependentsMessage(
      refusal([
        { kind: 'product', count: 1, names: ['کابل NYY'] },
        { kind: 'standard-bom', count: 1, names: ['MI-100'] },
        { kind: 'daily-bom', count: 3, names: ['ORD-1', 'ORD-2', 'ORD-3'] },
      ]),
      'edit',
    );

    expect(message).toBe(
      'امکان ویرایش این اطلاعات وجود ندارد، زیرا در ۱ محصول («کابل NYY») و ۱ آنالیز استاندارد («MI-100») و ۳ آنالیز روزانه («ORD-1، ORD-2، ORD-3») استفاده شده است.',
    );
  });

  it('phrases an equipment PM plan as «برنامه PM N تجهیز»', () => {
    const message = recordHasDependentsMessage(
      refusal([{ kind: 'equipment-pm-plan', count: 1, names: ['اکسترودر 1'] }]),
      'edit',
    );

    expect(message).toBe(
      'امکان ویرایش این اطلاعات وجود ندارد، زیرا در برنامه PM ۱ تجهیز («اکسترودر 1») استفاده شده است.',
    );
  });

  it('states a re-sampled daily BOM as a clause of its own, without a count', () => {
    const message = recordHasDependentsMessage(
      refusal([{ kind: 'resampled-daily-bom', count: 1, names: ['ORD-1'] }]),
      'delete',
    );

    expect(message).toBe(
      'امکان حذف این اطلاعات وجود ندارد، زیرا از این آنالیز روزانه نمونه گیری مجدد شده است.',
    );
  });

  it('joins a usage and a re-sampling with و', () => {
    const message = recordHasDependentsMessage(
      refusal([
        { kind: 'daily-bom', count: 1, names: ['ORD-9'] },
        { kind: 'resampled-daily-bom', count: 1, names: ['ORD-1'] },
      ]),
      'delete',
    );

    expect(message).toBe(
      'امکان حذف این اطلاعات وجود ندارد، زیرا در ۱ آنالیز روزانه («ORD-9») استفاده شده است و از این آنالیز روزانه نمونه گیری مجدد شده است.',
    );
  });

  it('leaves the parentheses out when the API names nothing', () => {
    const message = recordHasDependentsMessage(
      refusal([{ kind: 'product', count: 2, names: [] }]),
      'delete',
    );

    expect(message).toBe('امکان حذف این اطلاعات وجود ندارد، زیرا در ۲ محصول استفاده شده است.');
  });

  it('still refuses in words when the list of dependents is missing', () => {
    const message = recordHasDependentsMessage(refusal([]), 'delete');

    expect(message).toBe(
      'امکان حذف این اطلاعات وجود ندارد، زیرا در اطلاعات دیگری استفاده شده است.',
    );
  });

  it('answers nothing for any other refusal, so the caller keeps its own message', () => {
    const otherConflict = new HttpErrorResponse({
      status: 409,
      error: { type: PROBLEM.materialNameAlreadyExists },
    });

    expect(recordHasDependentsMessage(otherConflict, 'edit')).toBeUndefined();
    expect(recordHasDependentsMessage(new Error('boom'), 'edit')).toBeUndefined();
  });
});

describe('correctionConfirmationMessage', () => {
  it('names where the record is used, in the refusal’s words, and says the change reaches all of it', () => {
    const message = correctionConfirmationMessage(
      refusal([
        { kind: 'product', count: 1, names: ['کابل NYY'] },
        { kind: 'standard-bom', count: 2, names: ['MI-100', 'MI-200'] },
      ]),
    );

    expect(message).toBe(
      'این اطلاعات در ۱ محصول («کابل NYY») و ۲ آنالیز استاندارد («MI-100، MI-200») استفاده شده است. ' +
        'با تایید، این تغییر در همهٔ اطلاعات و سوابق مرتبط هم اعمال می‌شود.',
    );
  });

  it('answers nothing for any other refusal', () => {
    const otherConflict = new HttpErrorResponse({
      status: 409,
      error: { type: PROBLEM.materialCodeAlreadyExists },
    });

    expect(correctionConfirmationMessage(otherConflict)).toBeUndefined();
    expect(correctionConfirmationMessage(new Error('boom'))).toBeUndefined();
  });
});
