import { ComponentFixture, TestBed } from '@angular/core/testing';
import { describe, expect, it } from 'vitest';

import { PasswordVisibilityToggle } from './password-visibility-toggle';

function setUp() {
  TestBed.configureTestingModule({});

  const fixture: ComponentFixture<PasswordVisibilityToggle> =
    TestBed.createComponent(PasswordVisibilityToggle);
  fixture.detectChanges();

  const root = fixture.nativeElement as HTMLElement;

  return { fixture, root, button: root.querySelector('button') as HTMLButtonElement };
}

describe('PasswordVisibilityToggle', () => {
  it('starts hidden, so a password is never revealed by merely rendering the form', () => {
    const { fixture, button } = setUp();

    expect(fixture.componentInstance.visible()).toBe(false);
    expect(button.getAttribute('aria-pressed')).toBe('false');
    expect(button.getAttribute('aria-label')).toBe('نمایش رمز عبور');
  });

  it('flips on a press, and says so in its own accessible name', () => {
    const { fixture, button } = setUp();

    button.click();
    fixture.detectChanges();

    expect(fixture.componentInstance.visible()).toBe(true);
    expect(button.getAttribute('aria-pressed')).toBe('true');
    expect(button.getAttribute('aria-label')).toBe('پنهان کردن رمز عبور');
  });

  it('turns its icon to the primary colour while the password is showing', () => {
    const { fixture, button } = setUp();

    expect(button.classList.contains('password-toggle--pressed')).toBe(false);
    button.click();
    fixture.detectChanges();

    expect(button.classList.contains('password-toggle--pressed')).toBe(true);
  });

  it('flips back, so the visitor can hide what they revealed', () => {
    const { fixture, button } = setUp();

    button.click();
    fixture.detectChanges();
    button.click();
    fixture.detectChanges();

    expect(fixture.componentInstance.visible()).toBe(false);
  });

  // It is a button inside a form, and a form is submitted by Enter — an implicit `type="submit"`
  // would make revealing the password send the form.
  it('is not a submit button', () => {
    const { button } = setUp();

    expect(button.getAttribute('type')).toBe('button');
  });
});
