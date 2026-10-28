import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { MatSnackBar, MatSnackBarRef, TextOnlySnackBar } from '@angular/material/snack-bar';
import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  DailyBomDescriptionDialog,
  DailyBomDescriptionDialogData,
} from './daily-bom-description-dialog';

function setUp(data: DailyBomDescriptionDialogData) {
  const close = vi.fn();
  TestBed.configureTestingModule({
    providers: [
      provideHttpClient(),
      provideHttpClientTesting(),
      { provide: MatDialogRef, useValue: { close } },
      { provide: MAT_DIALOG_DATA, useValue: data },
    ],
  });
  const snackBar = vi
    .spyOn(TestBed.inject(MatSnackBar), 'open')
    .mockReturnValue({} as MatSnackBarRef<TextOnlySnackBar>);

  const fixture = TestBed.createComponent(DailyBomDescriptionDialog);
  return {
    fixture,
    close,
    snackBar,
    httpMock: TestBed.inject(HttpTestingController),
    root: fixture.nativeElement as HTMLElement,
  };
}

/** The textarea a visible label names. */
function fieldLabelled(root: HTMLElement, name: string): HTMLTextAreaElement | null {
  const label = Array.from(root.querySelectorAll('label')).find((element) =>
    element.textContent?.trim().startsWith(name),
  );
  const id = label?.getAttribute('for');
  return id ? root.querySelector<HTMLTextAreaElement>(`textarea[id="${id}"]`) : null;
}

const descriptionField = (root: HTMLElement) => fieldLabelled(root, 'توضیحات');
const reasonField = (root: HTMLElement) => fieldLabelled(root, 'دلیل ویرایش');

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

const data: DailyBomDescriptionDialogData = {
  bomId: 'bom-2',
  description: 'نوسان دستگاه شماره ۲',
};

describe('DailyBomDescriptionDialog', () => {
  afterEach(() => {
    TestBed.inject(HttpTestingController).verify();
  });

  it('is headed «ویرایش توضیحات» and offers «ذخیره» as its submit and «انصراف»', async () => {
    const { fixture, root } = setUp(data);
    await fixture.whenStable();

    expect(root.querySelector('h2')?.textContent?.trim()).toBe('ویرایش توضیحات');
    expect(root.querySelector('h2')?.hasAttribute('mat-dialog-title')).toBe(true);
    expect(buttonNamed(root, 'ذخیره')?.type).toBe('submit');
    expect(buttonNamed(root, 'انصراف')?.type).toBe('button');
  });

  it('fills the labelled «توضیحات» field with the current description', async () => {
    const { fixture, root } = setUp(data);
    await fixture.whenStable();

    expect(descriptionField(root)?.value).toBe('نوسان دستگاه شماره ۲');
  });

  it('asks why in an empty «دلیل ویرایش» textarea under the description', async () => {
    const { fixture, root } = setUp(data);
    await fixture.whenStable();

    expect(reasonField(root)?.value).toBe('');
  });

  it('sends only the edited description and why, as made on the dashboard, then closes reporting the save', async () => {
    const { fixture, root, httpMock, close } = setUp(data);
    await fixture.whenStable();

    type(descriptionField(root)!, 'دستگاه تنظیم شد');
    type(reasonField(root)!, 'اصلاح توضیحات');
    submitForm(root);
    await fixture.whenStable();

    const request = httpMock.expectOne({ method: 'PATCH', url: '/api/boms/bom-2' });
    expect(request.request.body).toEqual({
      description: 'دستگاه تنظیم شد',
      editReason: 'اصلاح توضیحات',
      editSource: 'dashboard',
    });
    expect(close).not.toHaveBeenCalled();

    request.flush(null, { status: 204, statusText: 'No Content' });
    await settle(fixture);

    expect(close).toHaveBeenCalledWith(true);
  });

  it('saves an emptied field, clearing the description', async () => {
    const { fixture, root, httpMock, close } = setUp(data);
    await fixture.whenStable();

    type(descriptionField(root)!, '');
    submitForm(root);
    await fixture.whenStable();

    const request = httpMock.expectOne({ method: 'PATCH', url: '/api/boms/bom-2' });
    expect(request.request.body).toMatchObject({ description: '' });
    request.flush(null, { status: 204, statusText: 'No Content' });
    await settle(fixture);

    expect(close).toHaveBeenCalledWith(true);
  });

  it('holds «ذخیره» while the save is out', async () => {
    const { fixture, root, httpMock } = setUp(data);
    await fixture.whenStable();

    submitForm(root);
    await fixture.whenStable();

    expect(buttonNamed(root, 'ذخیره')?.disabled).toBe(true);
    httpMock
      .expectOne({ method: 'PATCH', url: '/api/boms/bom-2' })
      .flush(null, { status: 204, statusText: 'No Content' });
    await settle(fixture);
  });

  it('says a reason is needed on its field, and stays open, when the API asks for one', async () => {
    const { fixture, root, httpMock, close, snackBar } = setUp(data);
    await fixture.whenStable();

    type(descriptionField(root)!, 'دستگاه تنظیم شد');
    submitForm(root);
    await fixture.whenStable();
    httpMock.expectOne({ method: 'PATCH', url: '/api/boms/bom-2' }).flush(
      {
        type: 'https://my-api-doc.dev/problems/edit-reason-required',
        title: 'Edit Reason Required',
        status: 400,
      },
      { status: 400, statusText: 'Bad Request' },
    );
    await settle(fixture);

    expect(close).not.toHaveBeenCalled();
    expect(snackBar).not.toHaveBeenCalled();
    expect(
      reasonField(root)?.closest('mat-form-field')?.querySelector('mat-error')?.textContent?.trim(),
    ).toBe('نوشتن دلیل ویرایش لازم است');
  });

  it.each([
    [403, 'شما اجازهٔ ویرایش آنالیز روزانه را ندارید.'],
    [500, 'توضیحات ذخیره نشد.'],
  ])('stays open and says why when the save answers %i', async (status, message) => {
    const { fixture, root, httpMock, close, snackBar } = setUp(data);
    await fixture.whenStable();

    submitForm(root);
    await fixture.whenStable();
    httpMock
      .expectOne({ method: 'PATCH', url: '/api/boms/bom-2' })
      .flush({ title: 'Failed' }, { status, statusText: 'Failed' });
    await settle(fixture);

    expect(close).not.toHaveBeenCalled();
    expect(snackBar).toHaveBeenCalledWith(message, 'باشه', expect.anything());
    expect(buttonNamed(root, 'ذخیره')?.disabled).toBe(false);
  });
});
