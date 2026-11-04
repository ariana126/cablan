import { HttpErrorResponse, provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { MatDialog, MatDialogRef } from '@angular/material/dialog';
import { Observable, of, throwError } from 'rxjs';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { Role } from '../../api/model';
import { PROBLEM } from '../../core/http/problem-details';
import { recordHasDependentsBody } from '../../core/http/testing/record-has-dependents-problem';
import { signInAs } from '../../core/identity/testing/sign-in-as';
import { CorrectionConfirmation } from './correction-confirmation';
import { CorrectionConfirmationDialog } from './correction-confirmation-dialog';

const IN_USE = new HttpErrorResponse({ status: 409, error: recordHasDependentsBody() });
const NAME_TAKEN = new HttpErrorResponse({
  status: 409,
  error: { type: PROBLEM.materialNameAlreadyExists },
});

describe('CorrectionConfirmation', () => {
  let httpMock: HttpTestingController;
  let confirmation: CorrectionConfirmation;
  let sent: boolean[];

  beforeEach(() => {
    localStorage.clear();
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    httpMock = TestBed.inject(HttpTestingController);
    confirmation = TestBed.inject(CorrectionConfirmation);
    sent = [];
  });

  afterEach(() => {
    httpMock.verify();
  });

  /** A save the API refuses as in use, unless it carries the correction flag. */
  const refusedUnlessApplied = (applyToRelatedRecords: boolean): Observable<void> => {
    sent.push(applyToRelatedRecords);
    return applyToRelatedRecords ? of(undefined) : throwError(() => IN_USE);
  };

  const answerTheDialog = (answer: boolean | undefined) =>
    vi
      .spyOn(TestBed.inject(MatDialog), 'open')
      .mockReturnValue({ afterClosed: () => of(answer) } as MatDialogRef<unknown, unknown>);

  it('saves once, without the flag, when nothing refuses it', async () => {
    await signInAs(Role.system_admin, httpMock);
    const open = answerTheDialog(true);

    const outcome = await confirmation.save(() => {
      sent.push(false);
      return of(undefined);
    }, true);

    expect(outcome).toBe('saved');
    expect(sent).toEqual([false]);
    expect(open).not.toHaveBeenCalled();
  });

  it('asks the System Admin, naming where the record is used, and re-sends with the flag on «تایید»', async () => {
    await signInAs(Role.system_admin, httpMock);
    const open = answerTheDialog(true);

    const outcome = await confirmation.save(refusedUnlessApplied, true);

    expect(outcome).toBe('saved');
    expect(sent).toEqual([false, true]);
    expect(open).toHaveBeenCalledWith(
      CorrectionConfirmationDialog,
      expect.objectContaining({
        data: {
          message:
            'این اطلاعات در ۱ محصول («کابل NYY») استفاده شده است. با تایید، این تغییر در همهٔ اطلاعات و سوابق مرتبط هم اعمال می‌شود.',
        },
      }),
    );
  });

  it.each([false, undefined])(
    'sends nothing more when the System Admin declines (closed with %s)',
    async (answer) => {
      await signInAs(Role.system_admin, httpMock);
      answerTheDialog(answer);

      const outcome = await confirmation.save(refusedUnlessApplied, true);

      expect(outcome).toBe('declined');
      expect(sent).toEqual([false]);
    },
  );

  it('hands a refusal of the confirmed correction back to the caller', async () => {
    await signInAs(Role.system_admin, httpMock);
    answerTheDialog(true);

    const saving = confirmation.save(
      (apply) => (apply ? throwError(() => NAME_TAKEN) : throwError(() => IN_USE)),
      true,
    );

    await expect(saving).rejects.toBe(NAME_TAKEN);
  });

  it.each([Role.technical_manager, Role.management, Role.qc_inspector])(
    'never asks a %s: the refusal goes back to the caller as it was',
    async (role) => {
      await signInAs(role, httpMock);
      const open = answerTheDialog(true);

      await expect(confirmation.save(refusedUnlessApplied, true)).rejects.toBe(IN_USE);
      expect(open).not.toHaveBeenCalled();
      expect(sent).toEqual([false]);
    },
  );

  it('never asks when the edit changed more than the correctable fields', async () => {
    await signInAs(Role.system_admin, httpMock);
    const open = answerTheDialog(true);

    await expect(confirmation.save(refusedUnlessApplied, false)).rejects.toBe(IN_USE);
    expect(open).not.toHaveBeenCalled();
  });

  it('never asks for any other refusal', async () => {
    await signInAs(Role.system_admin, httpMock);
    const open = answerTheDialog(true);

    await expect(confirmation.save(() => throwError(() => NAME_TAKEN), true)).rejects.toBe(
      NAME_TAKEN,
    );
    expect(open).not.toHaveBeenCalled();
  });
});
