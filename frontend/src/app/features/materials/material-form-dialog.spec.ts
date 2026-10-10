import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { MaterialFormDialog, MaterialFormDialogData } from './material-form-dialog';

/** The subset of the submit pipeline a spec needs to await directly. */
interface Submittable {
  onSubmit(): Promise<unknown>;
}

function setValue(element: Element | null, value: string): void {
  const input = element as HTMLInputElement;
  input.value = value;
  input.dispatchEvent(new Event('input'));
}

function findByLabel(root: HTMLElement, label: string): HTMLInputElement | null {
  const labels = Array.from(root.querySelectorAll('label'));
  const match = labels.find((element) => element.textContent?.trim().startsWith(label));
  const forAttr = match?.getAttribute('for');
  return forAttr ? root.querySelector(`#${forAttr}`) : null;
}

function setUp(data: MaterialFormDialogData) {
  const close = vi.fn();

  TestBed.configureTestingModule({
    providers: [
      provideHttpClient(),
      provideHttpClientTesting(),
      { provide: MatDialogRef, useValue: { close } },
      { provide: MAT_DIALOG_DATA, useValue: data },
    ],
  });

  const fixture = TestBed.createComponent(MaterialFormDialog);
  const httpMock = TestBed.inject(HttpTestingController);

  return { fixture, close, httpMock, root: fixture.nativeElement as HTMLElement };
}

describe('MaterialFormDialog', () => {
  afterEach(() => {
    TestBed.inject(HttpTestingController).verify();
  });

  describe('create mode', () => {
    it('starts with empty name and code fields', async () => {
      const { fixture, root } = setUp({ mode: 'create' });
      await fixture.whenStable();

      expect(findByLabel(root, 'اسم مواد اولیه')?.value).toBe('');
      expect(findByLabel(root, 'کد مواد اولیه')?.value).toBe('');
    });

    it('registers the material with its code and closes the dialog on success', async () => {
      const { fixture, root, close, httpMock } = setUp({ mode: 'create' });
      await fixture.whenStable();

      setValue(findByLabel(root, 'اسم مواد اولیه'), 'میلگرد فولادی');
      setValue(findByLabel(root, 'کد مواد اولیه'), ' RM-001 ');
      await fixture.whenStable();

      const page = fixture.componentInstance as unknown as Submittable;
      const submitted = page.onSubmit();
      const request = httpMock.expectOne({ method: 'POST', url: '/api/materials' });
      expect(request.request.body).toEqual({ name: 'میلگرد فولادی', code: 'RM-001' });
      request.flush({ id: '1' }, { status: 201, statusText: 'Created' });
      await submitted;

      expect(close).toHaveBeenCalledWith(true);
    });

    it('registers the material with no code when the code field is left blank', async () => {
      const { fixture, root, close, httpMock } = setUp({ mode: 'create' });
      await fixture.whenStable();

      setValue(findByLabel(root, 'اسم مواد اولیه'), 'میلگرد فولادی');
      setValue(findByLabel(root, 'کد مواد اولیه'), '   ');
      await fixture.whenStable();

      const page = fixture.componentInstance as unknown as Submittable;
      const submitted = page.onSubmit();
      const request = httpMock.expectOne({ method: 'POST', url: '/api/materials' });
      expect(request.request.body).toEqual({ name: 'میلگرد فولادی', code: null });
      request.flush({ id: '1' }, { status: 201, statusText: 'Created' });
      await submitted;

      expect(close).toHaveBeenCalledWith(true);
    });

    it('does not close and reports the field when the name is empty', async () => {
      const { fixture, root, close } = setUp({ mode: 'create' });
      await fixture.whenStable();

      const page = fixture.componentInstance as unknown as Submittable;
      await page.onSubmit();
      await fixture.whenStable();

      expect(close).not.toHaveBeenCalled();
      const nameField = findByLabel(root, 'اسم مواد اولیه')?.closest('mat-form-field');
      expect(nameField?.textContent).toContain('نام را وارد کنید');
    });

    it('does not close and reports the field when the name is already taken', async () => {
      const { fixture, root, close, httpMock } = setUp({ mode: 'create' });
      await fixture.whenStable();

      setValue(findByLabel(root, 'اسم مواد اولیه'), 'میلگرد فولادی');
      await fixture.whenStable();

      const page = fixture.componentInstance as unknown as Submittable;
      const submitted = page.onSubmit();
      httpMock
        .expectOne({ method: 'POST', url: '/api/materials' })
        .flush(
          { type: 'https://my-api-doc.dev/problems/material-name-already-exists' },
          { status: 409, statusText: 'Conflict' },
        );
      await submitted;
      await fixture.whenStable();

      expect(close).not.toHaveBeenCalled();
      const nameField = findByLabel(root, 'اسم مواد اولیه')?.closest('mat-form-field');
      expect(nameField?.textContent).toContain('این نام قبلاً برای مادهٔ اولیهٔ دیگری ثبت شده است');
    });
  });

  describe('edit mode', () => {
    const material = { id: 'material-1', name: 'میلگرد فولادی', code: 'RM-001' };

    it('pre-fills the form from the given material, code included', async () => {
      const { fixture, root } = setUp({ mode: 'edit', material });
      await fixture.whenStable();

      expect(findByLabel(root, 'اسم مواد اولیه')?.value).toBe('میلگرد فولادی');
      expect(findByLabel(root, 'کد مواد اولیه')?.value).toBe('RM-001');
    });

    it('pre-fills an empty code field for a material that has no code', async () => {
      const { fixture, root } = setUp({ mode: 'edit', material: { ...material, code: null } });
      await fixture.whenStable();

      expect(findByLabel(root, 'کد مواد اولیه')?.value).toBe('');
    });

    it('renames the material, keeping its code, and closes the dialog on success', async () => {
      const { fixture, root, close, httpMock } = setUp({ mode: 'edit', material });
      await fixture.whenStable();

      setValue(findByLabel(root, 'اسم مواد اولیه'), 'میلگرد آلیاژی');
      await fixture.whenStable();

      const page = fixture.componentInstance as unknown as Submittable;
      const submitted = page.onSubmit();
      const request = httpMock.expectOne({ method: 'PATCH', url: '/api/materials/material-1' });
      expect(request.request.body).toEqual({ name: 'میلگرد آلیاژی', code: 'RM-001' });
      request.flush(null, { status: 204, statusText: 'No Content' });
      await submitted;

      expect(close).toHaveBeenCalledWith(true);
    });

    it('changes the code', async () => {
      const { fixture, root, httpMock } = setUp({ mode: 'edit', material });
      await fixture.whenStable();

      setValue(findByLabel(root, 'کد مواد اولیه'), 'RM-002');
      await fixture.whenStable();

      const page = fixture.componentInstance as unknown as Submittable;
      const submitted = page.onSubmit();
      const request = httpMock.expectOne({ method: 'PATCH', url: '/api/materials/material-1' });
      expect(request.request.body).toEqual({ name: 'میلگرد فولادی', code: 'RM-002' });
      request.flush(null, { status: 204, statusText: 'No Content' });
      await submitted;
    });

    it('clears the code when the field is emptied', async () => {
      const { fixture, root, close, httpMock } = setUp({ mode: 'edit', material });
      await fixture.whenStable();

      setValue(findByLabel(root, 'کد مواد اولیه'), '');
      await fixture.whenStable();

      const page = fixture.componentInstance as unknown as Submittable;
      const submitted = page.onSubmit();
      const request = httpMock.expectOne({ method: 'PATCH', url: '/api/materials/material-1' });
      expect(request.request.body).toEqual({ name: 'میلگرد فولادی', code: null });
      request.flush(null, { status: 204, statusText: 'No Content' });
      await submitted;

      expect(close).toHaveBeenCalledWith(true);
    });
  });
});
