import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { PROBLEM } from '../../core/http/problem-details';
import { DailyBomRejectionDialog, DailyBomRejectionDialogData } from './daily-bom-rejection-dialog';

function setUp(data: DailyBomRejectionDialogData) {
  const close = vi.fn();
  TestBed.configureTestingModule({
    providers: [
      provideHttpClient(),
      provideHttpClientTesting(),
      { provide: MatDialogRef, useValue: { close } },
      { provide: MAT_DIALOG_DATA, useValue: data },
    ],
  });

  const fixture = TestBed.createComponent(DailyBomRejectionDialog);
  return {
    fixture,
    close,
    httpMock: TestBed.inject(HttpTestingController),
    root: fixture.nativeElement as HTMLElement,
  };
}

/** The textarea the visible «دلیل عدم تایید» label names. */
function reasonField(root: HTMLElement): HTMLTextAreaElement | null {
  const label = Array.from(root.querySelectorAll('label')).find((element) =>
    element.textContent?.trim().startsWith('دلیل عدم تایید'),
  );
  const id = label?.getAttribute('for');
  return id ? root.querySelector<HTMLTextAreaElement>(`textarea[id="${id}"]`) : null;
}

function buttonNamed(root: HTMLElement, name: string): HTMLButtonElement | undefined {
  return Array.from(root.querySelectorAll<HTMLButtonElement>('button')).find(
    (button) => (button.getAttribute('aria-label') ?? button.textContent?.trim()) === name,
  );
}

function type(field: HTMLTextAreaElement, value: string): void {
  field.value = value;
  field.dispatchEvent(new Event('input'));
}

function submitForm(root: HTMLElement): void {
  root.querySelector('form')?.dispatchEvent(new Event('submit'));
}

/** Lets a submit's `await` chain finish, then renders what it left. */
async function settle(fixture: { whenStable(): Promise<unknown> }): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve));
  await fixture.whenStable();
}

function fieldError(root: HTMLElement): string | undefined {
  return root.querySelector('mat-error')?.textContent?.trim();
}

function banner(root: HTMLElement): string | undefined {
  return root.querySelector('[role="alert"]')?.textContent?.trim();
}

const data: DailyBomRejectionDialogData = { bomId: 'bom-2', orderNumber: 'ORD-5002' };

const REJECTION = { method: 'POST', url: '/api/boms/bom-2/rejection' };

describe('DailyBomRejectionDialog', () => {
  afterEach(() => {
    TestBed.inject(HttpTestingController).verify();
  });

  it('names the daily BOM it rejects, and offers «عدم تایید» as its submit and «انصراف»', async () => {
    const { fixture, root } = setUp(data);
    await fixture.whenStable();

    expect(root.querySelector('h2')?.textContent?.trim()).toBe('عدم تایید آنالیز روزانه');
    expect(root.textContent).toContain('ORD-5002');
    expect(buttonNamed(root, 'عدم تایید')?.type).toBe('submit');
    expect(buttonNamed(root, 'انصراف')?.type).toBe('button');
  });

  it('asks for the reason in an empty, required field labelled «دلیل عدم تایید»', async () => {
    const { fixture, root } = setUp(data);
    await fixture.whenStable();

    const field = reasonField(root);
    expect(field?.value).toBe('');
    expect(field?.required).toBe(true);
  });

  it.each([
    ['empty', ''],
    ['only spaces', '   '],
  ])('sends nothing and asks for a reason when it is %s', async (_case, reason) => {
    const { fixture, root, httpMock, close } = setUp(data);
    await fixture.whenStable();

    type(reasonField(root)!, reason);
    submitForm(root);
    await settle(fixture);

    httpMock.expectNone(REJECTION);
    expect(close).not.toHaveBeenCalled();
    expect(fieldError(root)).toBe('دلیل عدم تایید را وارد کنید.');
  });

  it('rejects with the written reason, then closes reporting the rejection', async () => {
    const { fixture, root, httpMock, close } = setUp(data);
    await fixture.whenStable();

    type(reasonField(root)!, 'وزن مس خارج از محدوده است');
    submitForm(root);
    await fixture.whenStable();

    const request = httpMock.expectOne(REJECTION);
    expect(request.request.body).toEqual({ reason: 'وزن مس خارج از محدوده است' });
    expect(buttonNamed(root, 'عدم تایید')?.disabled).toBe(true);
    expect(close).not.toHaveBeenCalled();

    request.flush(null, { status: 204, statusText: 'No Content' });
    await settle(fixture);

    expect(close).toHaveBeenCalledWith('rejected');
  });

  it('closes reporting that someone else reviewed it first, so the card can re-read', async () => {
    const { fixture, root, httpMock, close } = setUp(data);
    await fixture.whenStable();

    type(reasonField(root)!, 'وزن مس خارج از محدوده است');
    submitForm(root);
    await fixture.whenStable();
    httpMock
      .expectOne(REJECTION)
      .flush(
        { type: PROBLEM.bomAlreadyReviewed, title: 'BOM Already Reviewed', status: 409 },
        { status: 409, statusText: 'Conflict' },
      );
    await settle(fixture);

    expect(close).toHaveBeenCalledWith('already-reviewed');
  });

  it('shows the API’s refusal of a blank reason on the field itself', async () => {
    const { fixture, root, httpMock, close } = setUp(data);
    await fixture.whenStable();

    type(reasonField(root)!, 'دلیل');
    submitForm(root);
    await fixture.whenStable();
    httpMock.expectOne(REJECTION).flush(
      {
        type: PROBLEM.rejectionReasonRequired,
        title: 'Rejection Reason Required',
        status: 400,
      },
      { status: 400, statusText: 'Bad Request' },
    );
    await settle(fixture);

    expect(close).not.toHaveBeenCalled();
    expect(fieldError(root)).toBe('دلیل عدم تایید را وارد کنید.');
  });

  it.each([
    [
      'the role may not',
      403,
      { title: 'Forbidden' },
      'شما اجازهٔ عدم تایید آنالیز روزانه را ندارید.',
    ],
    ['the server failed', 500, { title: 'Server Error' }, 'عدم تایید آنالیز روزانه انجام نشد.'],
  ])('stays open and says why when %s', async (_case, status, body, message) => {
    const { fixture, root, httpMock, close } = setUp(data);
    await fixture.whenStable();

    type(reasonField(root)!, 'وزن مس خارج از محدوده است');
    submitForm(root);
    await fixture.whenStable();
    httpMock.expectOne(REJECTION).flush(body, { status, statusText: 'Failed' });
    await settle(fixture);

    expect(close).not.toHaveBeenCalled();
    expect(banner(root)).toContain(message);
    expect(reasonField(root)?.value).toBe('وزن مس خارج از محدوده است');
  });
});
