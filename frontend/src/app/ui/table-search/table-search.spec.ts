import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { describe, expect, it } from 'vitest';

import { matchesSearch } from '../../core/i18n/search-normalizer';
import { TableSearch } from './table-search';

@Component({
  imports: [TableSearch],
  template: `<app-table-search label="جستجوی نام یا کد" [(value)]="query" />`,
})
class Host {
  readonly query = signal('');
}

async function render() {
  const fixture = TestBed.createComponent(Host);
  await fixture.whenStable();
  const input = (fixture.nativeElement as HTMLElement).querySelector('input')!;
  return { fixture, input };
}

describe('TableSearch', () => {
  it('is a search field named by its label', async () => {
    const { fixture, input } = await render();
    const label = (fixture.nativeElement as HTMLElement).querySelector('label');

    expect(label?.textContent?.trim()).toBe('جستجوی نام یا کد');
    expect(input.getAttribute('type')).toBe('search');
  });

  it('writes what is typed back to the bound value, as you type', async () => {
    const { fixture, input } = await render();

    input.value = 'مس';
    input.dispatchEvent(new Event('input'));
    await fixture.whenStable();

    expect(fixture.componentInstance.query()).toBe('مس');
  });

  it('shows a value set from outside', async () => {
    const { fixture, input } = await render();

    fixture.componentInstance.query.set('آلومینیوم');
    await fixture.whenStable();

    expect(input.value).toBe('آلومینیوم');
  });

  it('lets a page find Persian data from input typed with Arabic digits and letters', () => {
    // The page filters its rows with `matchesSearch`; the search field only supplies the text.
    expect(matchesSearch('کابل ۱۲۳', 'كابل ١٢٣')).toBe(true);
    expect(matchesSearch('کابل ۱۲۳', 'مس')).toBe(false);
  });
});
