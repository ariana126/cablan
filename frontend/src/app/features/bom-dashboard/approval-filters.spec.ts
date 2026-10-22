import { describe, expect, it } from 'vitest';

import { approvalStatusFilterOptions, approverFilterOptions } from './approval-filters';

describe('approvalStatusFilterOptions', () => {
  it('names each status the daily BOMs hold in words, approved first', () => {
    expect(approvalStatusFilterOptions({ approvalStatuses: ['unapproved', 'approved'] })).toEqual([
      { value: 'approved', label: 'تایید شده' },
      { value: 'unapproved', label: 'تایید نشده' },
    ]);
  });

  it('offers only the statuses that occur', () => {
    expect(approvalStatusFilterOptions({ approvalStatuses: ['approved'] })).toEqual([
      { value: 'approved', label: 'تایید شده' },
    ]);
  });
});

describe('approverFilterOptions', () => {
  it('lists each approver as given, then «بدون تایید کننده» while any daily BOM is unapproved', () => {
    expect(
      approverFilterOptions({
        approvalStatuses: ['approved', 'unapproved'],
        approvers: ['مصطفی', 'رضایی'],
      }),
    ).toEqual([
      { value: 'مصطفی', label: 'مصطفی' },
      { value: 'رضایی', label: 'رضایی' },
      { value: '', label: 'بدون تایید کننده' },
    ]);
  });

  it('leaves «بدون تایید کننده» out when every daily BOM is approved', () => {
    expect(approverFilterOptions({ approvalStatuses: ['approved'], approvers: ['مصطفی'] })).toEqual(
      [{ value: 'مصطفی', label: 'مصطفی' }],
    );
  });
});
