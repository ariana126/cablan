import { Location } from '@angular/common';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { NotFoundPage } from './not-found-page';

describe('NotFoundPage', () => {
  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideRouter([])] });
  });

  async function renderPage(): Promise<HTMLElement> {
    const fixture = TestBed.createComponent(NotFoundPage);
    await fixture.whenStable();

    return fixture.nativeElement as HTMLElement;
  }

  it('says what happened in a heading rather than only in an eyebrow', async () => {
    const heading = (await renderPage()).querySelector('h1');

    expect(heading?.textContent).toContain('چیزی در این نشانی نیست');
  });

  it('labels the error code «خطای ۴۰۴» rather than making a hero figure of it', async () => {
    const root = await renderPage();

    expect(root.textContent).toContain('خطای ۴۰۴');
  });

  it('offers to go back in history, and goes back when asked', async () => {
    const back = vi.spyOn(TestBed.inject(Location), 'back').mockImplementation(() => undefined);
    const root = await renderPage();

    const button = [...root.querySelectorAll('button')].find(
      (candidate) => candidate.textContent?.trim() === 'بازگشت',
    );
    button?.click();

    expect(back).toHaveBeenCalled();
  });

  it('offers a way back rather than leaving the visitor stranded', async () => {
    const home = (await renderPage()).querySelector('a');

    expect(home?.getAttribute('href')).toBe('/');
  });
});
