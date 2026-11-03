import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { PROBLEM } from '../../core/http/problem-details';
import { SpecialtyAssignmentDialog } from './specialty-assignment-dialog';

interface Submittable {
  onSubmit(): Promise<unknown>;
}

const ACTIVITIES = [
  { id: 'a1', name: 'روانکاری' },
  { id: 'a2', name: 'بازدید تابلو' },
];

const URL = '/api/maintenance-activities/specialty-assignment';

function setUp() {
  const close = vi.fn();
  TestBed.configureTestingModule({
    providers: [
      provideHttpClient(),
      provideHttpClientTesting(),
      { provide: MatDialogRef, useValue: { close } },
      { provide: MAT_DIALOG_DATA, useValue: { activities: ACTIVITIES } },
    ],
  });
  const fixture = TestBed.createComponent(SpecialtyAssignmentDialog);
  return {
    fixture,
    close,
    httpMock: TestBed.inject(HttpTestingController),
    root: fixture.nativeElement as HTMLElement,
    submit: () => (fixture.componentInstance as unknown as Submittable).onSubmit(),
  };
}

/** A radiogroup by its accessible name: the text of what `aria-labelledby` points at. */
function group(root: HTMLElement, name: string): HTMLElement | undefined {
  return Array.from(root.querySelectorAll<HTMLElement>('[role="radiogroup"]')).find(
    (candidate) =>
      root.querySelector(`#${candidate.getAttribute('aria-labelledby')}`)?.textContent?.trim() ===
      name,
  );
}

function radio(within: HTMLElement | undefined, label: string): HTMLInputElement | null {
  const labelElement = Array.from(within?.querySelectorAll('label') ?? []).find(
    (element) => element.textContent?.trim() === label,
  );
  const id = labelElement?.getAttribute('for');
  return id ? (within?.querySelector<HTMLInputElement>(`#${id}`) ?? null) : null;
}

describe('SpecialtyAssignmentDialog', () => {
  afterEach(() => {
    TestBed.inject(HttpTestingController).verify();
  });

  it('is headed «تعیین تخصص فعالیت های قبلی» and submits with «ثبت تخصص ها»', async () => {
    const { fixture, root } = setUp();
    await fixture.whenStable();

    expect(root.querySelector('h2')?.textContent?.trim()).toBe('تعیین تخصص فعالیت های قبلی');
    expect(
      Array.from(root.querySelectorAll('button[type="submit"]')).map((button) =>
        button.textContent?.trim(),
      ),
    ).toEqual(['ثبت تخصص ها']);
  });

  it('gives each activity its own choice, named exactly by the activity, «برق» or «مکانیک», neither chosen', async () => {
    const { fixture, root } = setUp();
    await fixture.whenStable();

    expect(root.querySelectorAll('[role="radiogroup"]')).toHaveLength(2);
    for (const { name } of ACTIVITIES) {
      expect(radio(group(root, name), 'برق')?.checked).toBe(false);
      expect(radio(group(root, name), 'مکانیک')?.checked).toBe(false);
    }
  });

  it('assigns every activity at once and closes', async () => {
    const { fixture, root, close, httpMock, submit } = setUp();
    await fixture.whenStable();

    radio(group(root, 'روانکاری'), 'مکانیک')?.click();
    radio(group(root, 'بازدید تابلو'), 'برق')?.click();
    await fixture.whenStable();
    const submitted = submit();
    const request = httpMock.expectOne({ method: 'POST', url: URL });
    expect(request.request.body).toEqual({
      assignments: [
        { activityId: 'a1', specialty: 'mechanical' },
        { activityId: 'a2', specialty: 'electrical' },
      ],
    });
    request.flush(null, { status: 204, statusText: 'No Content' });
    await submitted;

    expect(close).toHaveBeenCalledWith(true);
  });

  it('refuses until every activity has one, saying so, sending nothing and keeping the button enabled', async () => {
    const { fixture, root, close, submit } = setUp();
    await fixture.whenStable();

    radio(group(root, 'روانکاری'), 'مکانیک')?.click();
    await fixture.whenStable();
    await submit();
    await fixture.whenStable();

    expect(root.querySelector('[role="alert"]')?.textContent).toContain(
      'تخصص همه فعالیت ها باید تعیین شود.',
    );
    expect(group(root, 'بازدید تابلو')?.getAttribute('aria-invalid')).toBe('true');
    expect(group(root, 'روانکاری')?.getAttribute('aria-invalid')).not.toBe('true');
    expect(root.querySelector<HTMLButtonElement>('button[type="submit"]')?.disabled).toBe(false);
    expect(close).not.toHaveBeenCalled();
  });

  it('says so when the API finds the assignment incomplete, and stays open', async () => {
    const { fixture, root, close, httpMock, submit } = setUp();
    await fixture.whenStable();

    radio(group(root, 'روانکاری'), 'مکانیک')?.click();
    radio(group(root, 'بازدید تابلو'), 'برق')?.click();
    await fixture.whenStable();
    const submitted = submit();
    httpMock.expectOne({ method: 'POST', url: URL }).flush(
      {
        type: PROBLEM.specialtyAssignmentIncomplete,
        title: 'Specialty Assignment Incomplete',
        status: 400,
        detail: 'تخصص همه فعالیت ها باید تعیین شود.',
      },
      { status: 400, statusText: 'Bad Request' },
    );
    await submitted;
    await fixture.whenStable();

    expect(root.querySelector('[role="alert"]')?.textContent).toContain(
      'تخصص همه فعالیت ها باید تعیین شود.',
    );
    expect(close).not.toHaveBeenCalled();
  });

  it('says access is denied on a 403', async () => {
    const { fixture, root, httpMock, submit } = setUp();
    await fixture.whenStable();

    radio(group(root, 'روانکاری'), 'مکانیک')?.click();
    radio(group(root, 'بازدید تابلو'), 'برق')?.click();
    await fixture.whenStable();
    const submitted = submit();
    httpMock
      .expectOne({ method: 'POST', url: URL })
      .flush({ title: 'Forbidden' }, { status: 403, statusText: 'Forbidden' });
    await submitted;
    await fixture.whenStable();

    expect(root.querySelector('[role="alert"]')?.textContent).toContain(
      'شما اجازهٔ انجام این عملیات را ندارید.',
    );
  });

  it('can be put off on purpose with «بعداً», assigning nothing', async () => {
    const { fixture, root, close } = setUp();
    await fixture.whenStable();

    Array.from(root.querySelectorAll<HTMLButtonElement>('button'))
      .find((button) => button.textContent?.trim() === 'بعداً')
      ?.click();

    expect(close).toHaveBeenCalledWith(false);
  });
});
