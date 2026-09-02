import { ComponentFixture, TestBed } from '@angular/core/testing';
import { beforeEach, describe, expect, it } from 'vitest';

import { DateRangePresets, DateRange } from './date-range-presets';

describe('DateRangePresets', () => {
  let fixture: ComponentFixture<DateRangePresets>;
  let emitted: DateRange[];

  const buttonLabelled = (text: string): HTMLButtonElement => {
    const buttons: HTMLButtonElement[] = Array.from(
      fixture.nativeElement.querySelectorAll('button'),
    );
    const match = buttons.find((button) => button.textContent?.trim() === text);
    if (!match) {
      throw new Error(`no preset button labelled ${text}`);
    }
    return match;
  };

  const press = async (text: string): Promise<DateRange> => {
    buttonLabelled(text).click();
    await fixture.whenStable();
    return emitted[emitted.length - 1];
  };

  beforeEach(async () => {
    await TestBed.configureTestingModule({ imports: [DateRangePresets] }).compileComponents();

    fixture = TestBed.createComponent(DateRangePresets);
    fixture.componentRef.setInput('label', 'بازه‌های آماده ثبت');
    emitted = [];
    fixture.componentInstance.rangeSelected.subscribe((range) => emitted.push(range));
    await fixture.whenStable();
  });

  it('offers the three backward-looking ranges', () => {
    const labels = Array.from(fixture.nativeElement.querySelectorAll('button')).map((button) =>
      (button as HTMLButtonElement).textContent?.trim(),
    );

    expect(labels).toEqual(['امروز', '۷ روز گذشته', '۳۰ روز گذشته']);
  });

  it('groups the presets under a name, so they are not three loose buttons to a screen reader', () => {
    const group: HTMLElement = fixture.nativeElement.querySelector('[role="group"]');

    expect(group.getAttribute('aria-label')).toBe('بازه‌های آماده ثبت');
  });

  it('runs «امروز» from this morning’s midnight up to now', async () => {
    const before = new Date();

    const range = await press('امروز');

    const expectedFrom = new Date(before);
    expectedFrom.setHours(0, 0, 0, 0);
    expect(range.from).toEqual(expectedFrom);
    expect(range.to.getTime()).toBeGreaterThanOrEqual(before.getTime());
  });

  it('counts today as one of the seven days «۷ روز گذشته» covers', async () => {
    const range = await press('۷ روز گذشته');

    const expectedFrom = new Date();
    expectedFrom.setDate(expectedFrom.getDate() - 6);
    expectedFrom.setHours(0, 0, 0, 0);
    expect(range.from).toEqual(expectedFrom);
  });

  it('counts today as one of the thirty days «۳۰ روز گذشته» covers', async () => {
    const range = await press('۳۰ روز گذشته');

    const expectedFrom = new Date();
    expectedFrom.setDate(expectedFrom.getDate() - 29);
    expectedFrom.setHours(0, 0, 0, 0);
    expect(range.from).toEqual(expectedFrom);
  });

  it('starts every range at a midnight boundary, never at the current time of day', async () => {
    for (const label of ['امروز', '۷ روز گذشته', '۳۰ روز گذشته']) {
      const range = await press(label);

      expect([range.from.getHours(), range.from.getMinutes(), range.from.getSeconds()]).toEqual([
        0, 0, 0,
      ]);
    }
  });
});
