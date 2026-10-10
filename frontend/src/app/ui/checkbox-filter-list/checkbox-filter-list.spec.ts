import { ApplicationRef } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { describe, expect, it } from 'vitest';

import { CheckboxFilterList, CheckboxFilterOption } from './checkbox-filter-list';

const USERS: readonly CheckboxFilterOption<string>[] = [
  { value: 'u1', label: 'Ariana' },
  { value: 'u2', label: 'Yashar' },
  { value: 'u3', label: 'کیان' },
];

function setUp(selected: string[] = ['u1', 'u2', 'u3']) {
  const fixture = TestBed.createComponent(CheckboxFilterList<string>);
  fixture.componentRef.setInput('options', USERS);
  fixture.componentRef.setInput('selected', new Set(selected));
  const app = TestBed.inject(ApplicationRef);
  app.tick();
  const root = fixture.nativeElement as HTMLElement;

  const rows = () =>
    Array.from(root.querySelectorAll('mat-checkbox')).map((element) => ({
      text: element.textContent?.trim() ?? '',
      input: element.querySelector('input') as HTMLInputElement,
    }));
  const row = (name: string) => {
    const found = rows().find((candidate) => candidate.text.includes(name));
    if (!found) {
      throw new Error(`No checkbox "${name}"`);
    }
    return found.input;
  };
  const search = (query: string) => {
    const input = root.querySelector('input[type="search"]') as HTMLInputElement;
    input.value = query;
    input.dispatchEvent(new Event('input'));
    app.tick();
  };
  const click = (name: string) => {
    row(name).click();
    app.tick();
  };
  const selectedNow = () => fixture.componentInstance.selected();

  return { root, rows, row, search, click, selectedNow };
}

describe('CheckboxFilterList', () => {
  it('lists every option and a search box named "جستجو"', () => {
    const { root, rows } = setUp();

    expect(rows().map((r) => r.text)).toEqual(['انتخاب همه', 'Ariana', 'Yashar', 'کیان']);
    const input = root.querySelector('input[type="search"]') as HTMLInputElement;
    const label = root.querySelector(`label[for="${input.id}"]`);
    expect(label?.textContent).toContain('جستجو');
  });

  it('narrows the list to the options matching the typed text, ignoring case', () => {
    const { rows, search } = setUp();

    search('ar');

    expect(rows().map((r) => r.text)).toEqual(['انتخاب همه نتایج جستجو', 'Ariana', 'Yashar']);

    search('ARI');

    expect(rows().map((r) => r.text)).toEqual(['انتخاب همه نتایج جستجو', 'Ariana']);
  });

  it('finds Persian text typed with Arabic letters', () => {
    const { rows, search } = setUp();

    search('كيان');

    expect(rows().map((r) => r.text)).toContain('کیان');
  });

  it('selects and unselects a filtered option', () => {
    const { search, click, selectedNow } = setUp();
    search('ari');

    click('Ariana');
    expect([...selectedNow()]).not.toContain('u1');

    click('Ariana');
    expect([...selectedNow()]).toContain('u1');
  });

  it('keeps the selection of options filtered out of view', () => {
    const { search, click, selectedNow, row } = setUp(['u2']);
    search('ari');

    click('Ariana');
    search('');

    expect([...selectedNow()].sort()).toEqual(['u1', 'u2']);
    expect(row('Yashar').checked).toBe(true);
  });

  it('applies "select all" to the visible matches only while searching', () => {
    const { search, click, selectedNow } = setUp([]);
    search('ari');

    click('انتخاب همه نتایج جستجو');

    expect([...selectedNow()]).toEqual(['u1']);
  });

  it('selects everything with "select all" when not searching', () => {
    const { click, selectedNow } = setUp([]);

    click('انتخاب همه');

    expect([...selectedNow()].sort()).toEqual(['u1', 'u2', 'u3']);
  });

  it('says so when nothing matches', () => {
    const { root, search } = setUp();

    search('zzz');

    expect(root.querySelector('[role="status"]')?.textContent).toContain('موردی یافت نشد');
    expect(root.querySelectorAll('mat-checkbox').length).toBe(0);
  });
});
