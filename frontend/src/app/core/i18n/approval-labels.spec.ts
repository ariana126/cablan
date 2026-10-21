import { describe, expect, it } from 'vitest';

import { approvalStatusLabel, approverLabel, NO_APPROVER } from './approval-labels';

describe('approvalStatusLabel', () => {
  it.each([
    ['approved', 'تایید شده'],
    ['unapproved', 'تایید نشده'],
  ] as const)("names the '%s' status in words", (status, label) => {
    expect(approvalStatusLabel(status)).toBe(label);
  });
});

describe('approverLabel', () => {
  it("shows the approver's display name as it is", () => {
    expect(approverLabel('مصطفی')).toBe('مصطفی');
  });

  it.each([null, ''])(
    'shows a missing approver (%j) as a plain hyphen, not an em dash',
    (value) => {
      expect(approverLabel(value)).toBe('-');
      expect(NO_APPROVER).toBe('-');
    },
  );
});
