import { ChangeDetectionStrategy, Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { form, FormField, required, submit, ValidationError } from '@angular/forms/signals';
import { MatError, MatFormField, MatLabel } from '@angular/material/form-field';
import { MatInput } from '@angular/material/input';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { ErrorBanner } from '../error-banner/error-banner';
import { RevealFormErrors } from './reveal-form-errors';

interface Model {
  readonly name: string;
  readonly code: string;
}

type Answer = 'success' | 'root-error' | 'code-error';

/**
 * A long form dialog in miniature: the form-level banner at the top of the content, the fields far
 * below it, and the submit button at the end — where a visitor who scrolled down is looking.
 */
@Component({
  selector: 'app-long-form-host',
  imports: [ErrorBanner, FormField, MatError, MatFormField, MatInput, MatLabel, RevealFormErrors],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <form
      novalidate
      [appRevealFormErrors]="longForm"
      (submit)="onSubmit(); $event.preventDefault()"
    >
      @if (longForm().errors().length) {
        <app-error-banner [message]="longForm().errors()[0].message ?? ''" />
      }
      <p>…</p>
      <mat-form-field appearance="outline">
        <mat-label>نام</mat-label>
        <input matInput [formField]="longForm.name" />
        @if (longForm.name().touched() && longForm.name().errors().length) {
          <mat-error>{{ longForm.name().errors()[0].message }}</mat-error>
        }
      </mat-form-field>
      <mat-form-field appearance="outline">
        <mat-label>کد</mat-label>
        <input matInput [formField]="longForm.code" />
        @if (longForm.code().touched() && longForm.code().errors().length) {
          <mat-error>{{ longForm.code().errors()[0].message }}</mat-error>
        }
      </mat-form-field>
      <button type="submit">ثبت</button>
    </form>
  `,
})
class LongFormHost {
  readonly model = signal<Model>({ name: '', code: '' });
  readonly longForm = form(this.model, (path) => {
    required(path.name, { message: 'نام را وارد کنید.' });
    required(path.code, { message: 'کد را وارد کنید.' });
  });

  /** How the "server" answers the next submission. */
  answer: Answer = 'success';
  private resolveServer: (() => void) | undefined;

  /** Settles the pending submission with `answer`. */
  respond(): void {
    this.resolveServer?.();
  }

  onSubmit(): Promise<boolean> {
    return submit(this.longForm, async () => {
      await new Promise<void>((resolve) => (this.resolveServer = resolve));
      const errors: Record<Answer, ValidationError.WithOptionalFieldTree[] | undefined> = {
        success: undefined,
        'root-error': [{ kind: 'server', message: 'ثبت انجام نشد.' }],
        'code-error': [
          { kind: 'server', fieldTree: this.longForm.code, message: 'این کد قبلاً ثبت شده است.' },
        ],
      };
      return errors[this.answer];
    });
  }
}

async function setUp() {
  // TestBed attaches the host to the document, so focus is real.
  const fixture = TestBed.createComponent(LongFormHost);
  await fixture.whenStable();
  const root = fixture.nativeElement as HTMLElement;
  const input = (label: string) =>
    Array.from(root.querySelectorAll('mat-form-field'))
      .find((field) => field.querySelector('mat-label')?.textContent?.trim() === label)!
      .querySelector('input')!;
  const type = (label: string, value: string) => {
    input(label).value = value;
    input(label).dispatchEvent(new Event('input'));
  };
  const submitButton = root.querySelector<HTMLButtonElement>('button[type="submit"]')!;
  return { fixture, root, host: fixture.componentInstance, input, type, submitButton };
}

/** Lets the submission settle and the page render what came of it. */
async function settle(fixture: { whenStable(): Promise<unknown> }) {
  await fixture.whenStable();
  await new Promise((resolve) => setTimeout(resolve));
  await fixture.whenStable();
}

describe('RevealFormErrors', () => {
  let scrolled: Element[];

  beforeEach(() => {
    scrolled = [];
    // jsdom has no layout, so no scrollIntoView: record what was brought into view instead.
    Element.prototype.scrollIntoView = vi.fn(function (this: Element) {
      scrolled.push(this);
    });
  });

  afterEach(() => {
    delete (Element.prototype as Partial<Element>).scrollIntoView;
  });

  it('brings the first invalid field into view and focuses it when the form is refused as invalid', async () => {
    const { fixture, input, type, submitButton } = await setUp();
    type('نام', 'کابل');
    await fixture.whenStable();
    submitButton.focus();

    submitButton.click();
    await settle(fixture);

    expect(document.activeElement).toBe(input('کد'));
    expect(scrolled.some((element) => element.contains(input('کد')))).toBe(true);
  });

  it('brings the form-level error into view and focuses it when the server refuses the form', async () => {
    const { fixture, host, root, input, type, submitButton } = await setUp();
    type('نام', 'کابل');
    type('کد', 'A-1');
    host.answer = 'root-error';
    submitButton.click();
    await fixture.whenStable();

    host.respond();
    await settle(fixture);

    const alert = root.querySelector<HTMLElement>('[role="alert"]')!;
    expect(alert.textContent).toContain('ثبت انجام نشد.');
    expect(document.activeElement).toBe(alert);
    expect(scrolled).toContain(alert);
    // What the visitor typed is all still there.
    expect(input('نام').value).toBe('کابل');
    expect(input('کد').value).toBe('A-1');
  });

  it('focuses the field the server refused, with its reason under it', async () => {
    const { fixture, host, root, input, type, submitButton } = await setUp();
    type('نام', 'کابل');
    type('کد', 'A-1');
    host.answer = 'code-error';
    submitButton.click();
    await fixture.whenStable();

    host.respond();
    await settle(fixture);

    expect(document.activeElement).toBe(input('کد'));
    expect(root.querySelector('mat-error')?.textContent).toContain('این کد قبلاً ثبت شده است.');
  });

  it('leaves focus and scroll alone when the form is accepted', async () => {
    const { fixture, host, type, submitButton } = await setUp();
    type('نام', 'کابل');
    type('کد', 'A-1');
    submitButton.focus();
    submitButton.click();
    await fixture.whenStable();

    host.respond();
    await settle(fixture);

    expect(document.activeElement).toBe(submitButton);
    expect(scrolled).toEqual([]);
  });
});
