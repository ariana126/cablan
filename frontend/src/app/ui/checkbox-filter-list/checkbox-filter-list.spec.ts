import { ApplicationRef } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { describe, expect, it } from 'vitest';

import { CheckboxFilterList, CheckboxFilterOption } from './checkbox-filter-list';

const USERS: readonly CheckboxFilterOption<string>[] = [
  { value: 'u1', label: 'Ariana' },
  { value: 'u2', label: 'Yashar' },
  { value: 'u3', label: 'کیان' },
  { value: 'u4', label: 'ORD-5258' },
];

/** `undefined` is "no restriction": the field is not filtered. */
function setUp(selected: string[] | undefined = undefined) {
  const fixture = TestBed.createComponent(CheckboxFilterList<string>);
  fixture.componentRef.setInput('options', USERS);
  fixture.componentRef.setInput('selected', selected === undefined ? undefined : new Set(selected));
  const app = TestBed.inject(ApplicationRef);
  app.tick();
  const root = fixture.nativeElement as HTMLElement;
  let submitted = 0;
  fixture.componentInstance.submitted.subscribe(() => submitted++);

  const checkboxes = () =>
    Array.from(root.querySelectorAll('mat-checkbox')).map((element) => ({
      text: element.textContent?.replace(/\s+/g, ' ').trim() ?? '',
      input: element.querySelector('input') as HTMLInputElement,
    }));
  const checkbox = (name: string) => {
    const found = checkboxes().find((candidate) => candidate.text === name);
    if (!found) {
      throw new Error(`No checkbox "${name}" in ${checkboxes().map((c) => c.text)}`);
    }
    return found.input;
  };
  const searchBox = () => root.querySelector('input[type="search"]') as HTMLInputElement;
  const search = (query: string) => {
    searchBox().value = query;
    searchBox().dispatchEvent(new Event('input'));
    app.tick();
  };
  const pressEnter = () => {
    searchBox().dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
    app.tick();
  };
  const click = (name: string) => {
    checkbox(name).click();
    app.tick();
  };
  const selectedNow = () => {
    const value = fixture.componentInstance.selected();
    return value === undefined ? undefined : [...value].sort();
  };
  const chips = () =>
    Array.from(root.querySelectorAll('[aria-label="انتخاب‌های فعلی"] button')).map((button) =>
      button.getAttribute('aria-label'),
    );
  const removeChip = (label: string) => {
    const button = root.querySelector(
      `[aria-label="انتخاب‌های فعلی"] button[aria-label="حذف «${label}» از انتخاب‌ها"]`,
    ) as HTMLButtonElement;
    button.click();
    app.tick();
  };
  const message = () =>
    root.querySelector('.checkbox-filter-list__message')?.textContent?.trim() ?? '';
  const summary = () =>
    root.querySelector('.checkbox-filter-list__summary')?.textContent?.trim() ?? '';

  return {
    root,
    checkboxes,
    checkbox,
    search,
    pressEnter,
    click,
    selectedNow,
    chips,
    removeChip,
    message,
    summary,
    submittedCount: () => submitted,
    searchBox,
  };
}

describe('CheckboxFilterList', () => {
  it('names its search box «جستجو در مقادیر» unless the host says otherwise', () => {
    const { root, searchBox } = setUp();

    expect(root.querySelector(`label[for="${searchBox().id}"]`)?.textContent?.trim()).toBe(
      'جستجو در مقادیر',
    );
  });

  it('shows how many rows carry each value, in Persian digits, when it is told', () => {
    const fixture = TestBed.createComponent(CheckboxFilterList<string>);
    fixture.componentRef.setInput('options', [
      { value: 'a', label: 'کابلان', count: 24 },
      { value: 'b', label: 'Test' },
    ]);
    fixture.componentRef.setInput('selected', undefined);
    TestBed.inject(ApplicationRef).tick();

    const rows = Array.from(
      (fixture.nativeElement as HTMLElement).querySelectorAll('mat-checkbox'),
    ).map((element) => element.textContent?.replace(/\s+/g, ' ').trim());
    expect(rows).toContain('کابلان ۲۴');
    expect(rows).toContain('Test');
  });

  describe('an unfiltered field', () => {
    it('opens with nothing ticked and says there is no restriction', () => {
      const { checkboxes, summary } = setUp();

      expect(checkboxes().every((c) => !c.input.checked)).toBe(true);
      expect(summary()).toBe('بدون محدودیت — همه مقادیر');
    });

    it('starts a selection of exactly the value ticked', () => {
      const { click, selectedNow, summary } = setUp();

      click('Yashar');

      expect(selectedNow()).toEqual(['u2']);
      expect(summary()).toBe('۱ مقدار انتخاب‌شده');
    });
  });

  it('lists the options under a group checkbox named «انتخاب همه»', () => {
    const { checkboxes } = setUp();

    expect(checkboxes().map((c) => c.text)).toEqual([
      'انتخاب همه',
      'Ariana',
      'Yashar',
      'کیان',
      'ORD-5258',
    ]);
  });

  it('ticks every value with «انتخاب همه»', () => {
    const { click, selectedNow } = setUp();

    click('انتخاب همه');

    expect(selectedNow()).toEqual(['u1', 'u2', 'u3', 'u4']);
  });

  it('unticking «انتخاب همه» while every value is ticked leaves an explicitly empty selection', () => {
    const { click, selectedNow, summary } = setUp(['u1', 'u2', 'u3', 'u4']);

    click('انتخاب همه');

    expect(selectedNow()).toEqual([]);
    expect(summary()).toBe('هیچ مقداری انتخاب نشده — فهرست خالی می‌شود');
  });

  describe('searching', () => {
    it('narrows the list to the matches, ignoring case, and names the group checkbox by its scope', () => {
      const { checkboxes, search, summary } = setUp();

      search('ar');

      expect(checkboxes().map((c) => c.text)).toEqual([
        'انتخاب همه ۲ نتیجه جستجو',
        'Ariana',
        'Yashar',
      ]);
      expect(summary()).toBe('۲ نتیجه جستجو');
    });

    it('finds Persian text typed with Arabic letters, and Latin digits typed in Persian', () => {
      const { checkboxes, search } = setUp();

      search('كيان');
      expect(checkboxes().map((c) => c.text)).toContain('کیان');

      search('۵۲۵۸');
      expect(checkboxes().map((c) => c.text)).toContain('ORD-5258');
    });

    it('keeps the selection across separate searches', () => {
      const { search, click, selectedNow } = setUp();

      search('ari');
      click('Ariana');
      search('کیان');
      click('کیان');
      search('');

      expect(selectedNow()).toEqual(['u1', 'u3']);
    });

    it('acts on the visible matches only with the group checkbox', () => {
      const { search, click, selectedNow } = setUp(['u3']);

      search('ar');
      click('انتخاب همه ۲ نتیجه جستجو');

      expect(selectedNow()).toEqual(['u1', 'u2', 'u3']);

      click('انتخاب همه ۲ نتیجه جستجو');

      expect(selectedNow()).toEqual(['u3']);
    });

    it('says so when nothing matches, and keeps the selection', () => {
      const { root, search, selectedNow } = setUp(['u2']);

      search('zzz');

      expect(root.querySelector('[role="status"]')?.textContent).toContain('موردی یافت نشد');
      expect(root.querySelectorAll('mat-checkbox').length).toBe(0);
      expect(selectedNow()).toEqual(['u2']);
    });
  });

  describe('the current selection', () => {
    it('shows every selected value as a removable chip, even one hidden by the search', () => {
      const { chips, search } = setUp(['u1', 'u3']);

      search('Yashar');

      expect(chips()).toEqual(['حذف «Ariana» از انتخاب‌ها', 'حذف «کیان» از انتخاب‌ها']);
    });

    it('drops a value from the selection when its chip is removed', () => {
      const { removeChip, selectedNow } = setUp(['u1', 'u3']);

      removeChip('Ariana');

      expect(selectedNow()).toEqual(['u3']);
    });

    it('shows no chips while the field is unrestricted', () => {
      const { root } = setUp();

      expect(root.querySelector('[aria-label="انتخاب‌های فعلی"]')).toBeNull();
    });
  });

  describe('Enter in the search box', () => {
    it('adds the one match to the selection and clears the search', () => {
      const { search, pressEnter, selectedNow, searchBox } = setUp(['u3']);

      search('yash');
      pressEnter();

      expect(selectedNow()).toEqual(['u2', 'u3']);
      expect(searchBox().value).toBe('');
    });

    it('guesses nothing among several matches and says so politely', () => {
      const { root, search, pressEnter, selectedNow, message } = setUp();

      search('ar');
      pressEnter();

      expect(selectedNow()).toBeUndefined();
      expect(message()).toBe('چند نتیجه یافت شد؛ مورد موردنظر را انتخاب کنید');
      expect(root.querySelector('.checkbox-filter-list__message')?.getAttribute('aria-live')).toBe(
        'polite',
      );
    });

    it('changes nothing when nothing matches', () => {
      const { search, pressEnter, selectedNow, submittedCount } = setUp(['u1']);

      search('zzz');
      pressEnter();

      expect(selectedNow()).toEqual(['u1']);
      expect(submittedCount()).toBe(0);
    });

    it('asks the host to apply when the search is empty', () => {
      const { pressEnter, submittedCount } = setUp();

      pressEnter();

      expect(submittedCount()).toBe(1);
    });
  });
});
