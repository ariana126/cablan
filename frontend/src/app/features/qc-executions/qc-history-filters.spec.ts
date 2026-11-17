import { describe, expect, it } from 'vitest';

import { NO_QC_HISTORY_FILTER, toQcExecutionFilters } from './qc-history-filters';

describe('toQcExecutionFilters', () => {
  it('asks for everything when nothing is chosen', () => {
    expect(toQcExecutionFilters(NO_QC_HISTORY_FILTER)).toEqual({});
  });

  it('sends a chosen range as the whole of each Tehran day', () => {
    expect(
      toQcExecutionFilters({
        ...NO_QC_HISTORY_FILTER,
        from: new Date(2026, 8, 23),
        to: new Date(2026, 8, 24),
      }),
    ).toEqual({ from: '2026-09-22T20:30:00.000Z', to: '2026-09-24T20:29:59.999Z' });
  });

  it('leaves an open end of the range open', () => {
    expect(toQcExecutionFilters({ ...NO_QC_HISTORY_FILTER, to: new Date(2026, 8, 24) })).toEqual({
      to: '2026-09-24T20:29:59.999Z',
    });
  });

  it('sends the chosen equipment, activity and recorder, and the tracking number trimmed', () => {
    expect(
      toQcExecutionFilters({
        ...NO_QC_HISTORY_FILTER,
        equipmentId: 'e1',
        activityId: 'q1',
        performedById: 'u1',
        trackingNumber: ' TR-1 ',
      }),
    ).toEqual({ equipmentId: 'e1', activityId: 'q1', performedById: 'u1', trackingNumber: 'TR-1' });
  });
});
