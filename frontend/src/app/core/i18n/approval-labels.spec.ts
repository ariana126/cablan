import { describe, expect, it } from 'vitest';

import {
  approvalStatusLabel,
  NO_REVIEWER,
  NO_REVIEWER_FILTER_LABEL,
  NO_REVIEWER_FILTER_VALUE,
  reviewerLabel,
} from './approval-labels';

describe('approvalStatusLabel', () => {
  it.each([
    ['pending', 'در انتظار تایید'],
    ['approved', 'تایید'],
    ['rejected', 'عدم تایید'],
  ] as const)("names the '%s' status in words", (status, label) => {
    expect(approvalStatusLabel(status)).toBe(label);
  });
});

describe('reviewerLabel', () => {
  it("shows the reviewer's display name as it is", () => {
    expect(reviewerLabel('مصطفی')).toBe('مصطفی');
  });

  it.each([null, ''])(
    'shows a missing reviewer (%j) as a plain hyphen, not an em dash',
    (value) => {
      expect(reviewerLabel(value)).toBe('-');
      expect(NO_REVIEWER).toBe('-');
    },
  );
});

describe('the no-reviewer filter value', () => {
  it('is the blank value, read as «بدون تایید/رد کننده»', () => {
    expect(NO_REVIEWER_FILTER_VALUE).toBe('');
    expect(NO_REVIEWER_FILTER_LABEL).toBe('بدون تایید/رد کننده');
  });
});
