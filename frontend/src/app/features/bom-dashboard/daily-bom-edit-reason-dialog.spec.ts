import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  DailyBomEditReasonDialog,
  DailyBomEditReasonDialogData,
} from './daily-bom-edit-reason-dialog';

const data: DailyBomEditReasonDialogData = {
  bomId: 'bom-2',
  orderNumber: 'ORD-5002',
  changes: {
    standardBomMiCode: '1001',
    components: [{ componentId: 'c1', materials: [{ materialId: 'm1', weight: 2 }] }],
  },
};

function setUp() {
  const close = vi.fn();
  TestBed.configureTestingModule({
    providers: [
      provideHttpClient(),
      provideHttpClientTesting(),
      { provide: MatDialogRef, useValue: { close } },
      { provide: MAT_DIALOG_DATA, useValue: data },
    ],
  });
  const fixture = TestBed.createComponent(DailyBomEditReasonDialog);
  return {
    fixture,
    close,
    httpMock: TestBed.inject(HttpTestingController),
    root: fixture.nativeElement as HTMLElement,
  };
}

/** The textarea the visible «دلیل ویرایش» label names. */
function reasonField(root: HTMLElement): HTMLTextAreaElement | null {
  const label = Array.from(root.querySelectorAll('label')).find((element) =>
    element.textContent?.trim().startsWith('دلیل ویرایش'),
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

/** Lets a save's `await` chain finish, then renders what it left. */
async function settle(fixture: { whenStable(): Promise<unknown> }): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve));
  await fixture.whenStable();
}

async function answer(status: number, body: object) {
  const { fixture, root, httpMock, close } = setUp();
  await fixture.whenStable();
  type(reasonField(root)!, 'اندازه گیری مجدد');
  submitForm(root);
  await fixture.whenStable();
  httpMock
    .expectOne({ method: 'PATCH', url: '/api/boms/bom-2' })
    .flush(body, { status, statusText: 'Refused' });
  await settle(fixture);
  return { root, close };
}

/** The error shown under the reason field, or at the top of the dialog. */
const fieldError = (root: HTMLElement) =>
  reasonField(root)?.closest('mat-form-field')?.querySelector('mat-error')?.textContent?.trim();
const bannerText = (root: HTMLElement) =>
  root.querySelector('app-error-banner')?.textContent?.trim();

describe('DailyBomEditReasonDialog', () => {
  afterEach(() => {
    TestBed.inject(HttpTestingController).verify();
  });

  it('asks why in an empty «دلیل ویرایش» textarea, with «انصراف» and the submit «ثبت»', async () => {
    const { fixture, root } = setUp();
    await fixture.whenStable();

    expect(root.querySelector('h2')?.hasAttribute('mat-dialog-title')).toBe(true);
    expect(root.textContent).toContain('ORD-5002');
    expect(reasonField(root)?.value).toBe('');
    expect(buttonNamed(root, 'ثبت')?.type).toBe('submit');
    expect(buttonNamed(root, 'انصراف')?.type).toBe('button');
  });

  it('sends the edit with the reason, as made on the dashboard, then closes reporting the save', async () => {
    const { fixture, root, httpMock, close } = setUp();
    await fixture.whenStable();

    type(reasonField(root)!, 'اندازه گیری مجدد');
    submitForm(root);
    await fixture.whenStable();

    const request = httpMock.expectOne({ method: 'PATCH', url: '/api/boms/bom-2' });
    expect(request.request.body).toEqual({
      standardBomMiCode: '1001',
      components: [{ componentId: 'c1', materials: [{ materialId: 'm1', weight: 2 }] }],
      editReason: 'اندازه گیری مجدد',
      editSource: 'dashboard',
    });
    expect(close).not.toHaveBeenCalled();

    request.flush(null, { status: 204, statusText: 'No Content' });
    await settle(fixture);

    expect(close).toHaveBeenCalledWith(true);
  });

  it('holds «ثبت» while the save is out', async () => {
    const { fixture, root, httpMock } = setUp();
    await fixture.whenStable();

    submitForm(root);
    await fixture.whenStable();

    expect(buttonNamed(root, 'ثبت')?.disabled).toBe(true);
    httpMock
      .expectOne({ method: 'PATCH', url: '/api/boms/bom-2' })
      .flush(null, { status: 204, statusText: 'No Content' });
    await settle(fixture);
  });

  it('says a reason is needed on its field, and stays open, when the API asks for one', async () => {
    const { root, close } = await answer(400, {
      type: 'https://my-api-doc.dev/problems/edit-reason-required',
      title: 'Edit Reason Required',
      status: 400,
    });

    expect(close).not.toHaveBeenCalled();
    expect(fieldError(root)).toBe('نوشتن دلیل ویرایش لازم است');
  });

  it("explains, at the top, a line that is no longer in the standard BOM's composition", async () => {
    const { root, close } = await answer(404, {
      type: 'https://my-api-doc.dev/problems/bom-composition-entry-not-found',
      title: 'Not Found',
      status: 404,
    });

    expect(close).not.toHaveBeenCalled();
    expect(bannerText(root)).toBe(
      'این آنالیز روزانه اجزا یا مواد اولیه‌ای دارد که دیگر در آنالیز استاندارد نیست؛ ویرایش ممکن نیست.',
    );
  });

  it.each([
    [403, 'شما اجازهٔ ویرایش آنالیز روزانه را ندارید.'],
    [500, 'ویرایش آنالیز روزانه ذخیره نشد.'],
  ])('stays open and says why, at the top, when the save answers %i', async (status, message) => {
    const { root, close } = await answer(status, { title: 'Failed' });

    expect(close).not.toHaveBeenCalled();
    expect(bannerText(root)).toBe(message);
  });
});
