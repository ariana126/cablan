import { describe, expect, it } from 'vitest';

import {
  approvalStatusFilterOptions,
  DEFAULT_DASHBOARD_APPROVAL_FILTERS,
  reviewerFilterOptions,
  withReviewers,
} from './approval-filters';

describe('DEFAULT_DASHBOARD_APPROVAL_FILTERS', () => {
  it('opens the dashboard on the daily BOMs still pending review, whoever reviews them', () => {
    expect(DEFAULT_DASHBOARD_APPROVAL_FILTERS).toEqual({ approvalStatuses: ['pending'] });
  });
});

describe('approvalStatusFilterOptions', () => {
  it('names each status the daily BOMs hold in words, pending first, then approved, then rejected', () => {
    expect(
      approvalStatusFilterOptions({ approvalStatuses: ['rejected', 'approved', 'pending'] }),
    ).toEqual([
      { value: 'pending', label: 'در انتظار تایید' },
      { value: 'approved', label: 'تایید' },
      { value: 'rejected', label: 'عدم تایید' },
    ]);
  });

  it('offers only the statuses that occur', () => {
    expect(approvalStatusFilterOptions({ approvalStatuses: ['approved'] })).toEqual([
      { value: 'approved', label: 'تایید' },
    ]);
  });
});

describe('withReviewers', () => {
  it('lifts the untouched default status filter when the reviewers exclude the blank one — a pending BOM has no reviewer', () => {
    expect(withReviewers(DEFAULT_DASHBOARD_APPROVAL_FILTERS, ['مصطفی'], false)).toEqual({
      approvalStatuses: undefined,
      reviewers: ['مصطفی'],
    });
  });

  it('keeps the default status filter while «بدون تایید/رد کننده» is among the reviewers', () => {
    expect(withReviewers(DEFAULT_DASHBOARD_APPROVAL_FILTERS, ['مصطفی', ''], false)).toEqual({
      approvalStatuses: ['pending'],
      reviewers: ['مصطفی', ''],
    });
  });

  it('keeps the default status filter when the reviewer filter is lifted', () => {
    expect(withReviewers(DEFAULT_DASHBOARD_APPROVAL_FILTERS, undefined, false)).toEqual({
      approvalStatuses: ['pending'],
      reviewers: undefined,
    });
  });

  it('leaves statuses the visitor chose alone', () => {
    expect(withReviewers({ approvalStatuses: ['pending'] }, ['مصطفی'], true)).toEqual({
      approvalStatuses: ['pending'],
      reviewers: ['مصطفی'],
    });
  });
});

describe('reviewerFilterOptions', () => {
  it('lists each reviewer as given, then «بدون تایید/رد کننده» while any daily BOM is pending', () => {
    expect(
      reviewerFilterOptions({
        approvalStatuses: ['approved', 'pending'],
        reviewers: ['مصطفی', 'رضایی'],
      }),
    ).toEqual([
      { value: 'مصطفی', label: 'مصطفی' },
      { value: 'رضایی', label: 'رضایی' },
      { value: '', label: 'بدون تایید/رد کننده' },
    ]);
  });

  it('leaves «بدون تایید/رد کننده» out when every daily BOM has been reviewed', () => {
    expect(
      reviewerFilterOptions({ approvalStatuses: ['approved', 'rejected'], reviewers: ['مصطفی'] }),
    ).toEqual([{ value: 'مصطفی', label: 'مصطفی' }]);
  });
});
