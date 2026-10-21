import { describe, expect, it } from 'vitest';

import { ACTION_LABELS } from './action-labels';

describe('ACTION_LABELS', () => {
  it.each([
    ['Registered', 'ثبت'],
    ['Edited', 'ویرایش'],
    ['Deleted', 'حذف'],
    ['Approved', 'تایید'],
    ['ApprovalRevoked', 'لغو تایید'],
  ] as const)("names the '%s' action in Persian", (action, label) => {
    expect(ACTION_LABELS[action]).toBe(label);
  });
});
