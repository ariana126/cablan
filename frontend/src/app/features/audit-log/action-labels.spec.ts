import { describe, expect, it } from 'vitest';

import { ACTION_LABELS, actionLabel } from './action-labels';

describe('ACTION_LABELS', () => {
  it.each([
    ['Registered', 'ثبت'],
    ['Edited', 'ویرایش'],
    ['Deleted', 'حذف'],
    ['Approved', 'تایید'],
    ['Rejected', 'عدم تایید'],
    ['ReturnedToPending', 'بازگشت به در انتظار تایید'],
    // Revocation no longer exists, but entries recorded before it went still do.
    ['ApprovalRevoked', 'لغو تایید'],
    ['Imported', 'بارگذاری گروهی'],
    ['Reverted', 'برگرداندن'],
    // Equipment taken out of service — kept, so not a deletion.
    ['Retired', 'کنار گذاشتن'],
    // A PM plan row taken out of the plan for good — kept, so not a deletion either.
    ['Deactivated', 'غیرفعال‌سازی'],
    // Retired equipment back in service (issue #110).
    ['Reactivated', 'فعال سازی دوباره'],
  ] as const)("names the '%s' action in Persian", (action, label) => {
    expect(ACTION_LABELS[action]).toBe(label);
  });
});

describe('actionLabel', () => {
  // Issue #110: the System Admin's deletions and reactivation, named for what went or came back.
  it.each([
    ['MaintenanceExecution', 'Deleted', 'حذف سابقه انجام'],
    ['PmPlanItem', 'Deleted', 'حذف ردیف غیرفعال برنامه'],
    ['Equipment', 'Deleted', 'حذف تجهیز'],
    ['Equipment', 'Reactivated', 'فعال سازی دوباره تجهیز'],
  ] as const)("names a '%s' '%s' entry by what it did to it", (recordType, action, label) => {
    expect(actionLabel(recordType, action)).toBe(label);
  });

  it('names every other entry by its action alone', () => {
    expect(actionLabel('Material', 'Deleted')).toBe('حذف');
    expect(actionLabel('Equipment', 'Retired')).toBe('کنار گذاشتن');
  });
});
