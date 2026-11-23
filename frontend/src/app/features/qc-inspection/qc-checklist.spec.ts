import { describe, expect, it } from 'vitest';

import { QcChecklist } from './qc-checklist';

const OFFERED = ['q1', 'q2', 'q3'];

describe('QcChecklist', () => {
  it('starts with nothing ticked', () => {
    const checklist = new QcChecklist();

    expect(checklist.isTicked('q1')).toBe(false);
    expect(checklist.tickedAmong(OFFERED)).toEqual([]);
  });

  it('gives the ticked activities in the order they are offered, each with its own notes', () => {
    const checklist = new QcChecklist();

    checklist.tick('q3', true);
    checklist.tick('q1', true);
    checklist.writeNotes('q1', 'خراش جزئی');

    expect(checklist.tickedAmong(OFFERED)).toEqual([
      { activityId: 'q1', notes: 'خراش جزئی' },
      { activityId: 'q3', notes: '' },
    ]);
  });

  it('drops an activity, and its notes, when it is unticked', () => {
    const checklist = new QcChecklist();
    checklist.tick('q1', true);
    checklist.writeNotes('q1', 'خراش جزئی');

    checklist.tick('q1', false);
    checklist.tick('q1', true);

    expect(checklist.tickedAmong(OFFERED)).toEqual([{ activityId: 'q1', notes: '' }]);
  });

  it('ignores notes for an activity that is not ticked', () => {
    const checklist = new QcChecklist();

    checklist.writeNotes('q1', 'خراش جزئی');

    expect(checklist.notesOf('q1')).toBe('');
    expect(checklist.isTicked('q1')).toBe(false);
  });

  it('leaves out a ticked activity no longer offered', () => {
    const checklist = new QcChecklist();
    checklist.tick('q1', true);
    checklist.tick('q2', true);

    expect(checklist.tickedAmong(['q2'])).toEqual([{ activityId: 'q2', notes: '' }]);
  });

  describe('a pending submission — sent, but not every activity answered', () => {
    function withPending() {
      const checklist = new QcChecklist();
      checklist.tick('q1', true);
      checklist.writeNotes('q1', 'خراش جزئی');
      checklist.tick('q2', true);
      checklist.hold({ submissionId: 's-1', trackingNumber: 'TR-100' }, OFFERED);
      return checklist;
    }

    it('has none at first', () => {
      expect(new QcChecklist().pendingSubmission(OFFERED)).toBeUndefined();
    });

    it('is offered again while the same activities are ticked with the same notes', () => {
      expect(withPending().pendingSubmission(OFFERED)).toEqual({
        submissionId: 's-1',
        trackingNumber: 'TR-100',
      });
    });

    it('is dropped once it is released', () => {
      const checklist = withPending();

      checklist.release();

      expect(checklist.pendingSubmission(OFFERED)).toBeUndefined();
    });

    it('is dropped when an activity is ticked or unticked', () => {
      const ticked = withPending();
      ticked.tick('q3', true);
      expect(ticked.pendingSubmission(OFFERED)).toBeUndefined();

      const unticked = withPending();
      unticked.tick('q2', false);
      expect(unticked.pendingSubmission(OFFERED)).toBeUndefined();
    });

    it('is dropped when notes change, and kept when they are written unchanged', () => {
      const same = withPending();
      same.writeNotes('q1', 'خراش جزئی');
      expect(same.pendingSubmission(OFFERED)).toBeDefined();

      const changed = withPending();
      changed.writeNotes('q1', 'خراش عمیق');
      expect(changed.pendingSubmission(OFFERED)).toBeUndefined();
    });

    it('is kept when clearing removes nothing ticked', () => {
      const checklist = withPending();

      checklist.clear([]);
      checklist.clear(['q3']);

      expect(checklist.pendingSubmission(OFFERED)).toBeDefined();
    });

    it('is not offered for a ticked set it was not held for', () => {
      expect(withPending().pendingSubmission(['q1'])).toBeUndefined();
    });
  });

  it('clears the given activities and keeps the rest as they were', () => {
    const checklist = new QcChecklist();
    checklist.tick('q1', true);
    checklist.tick('q2', true);
    checklist.writeNotes('q2', 'دوباره بررسی شود');

    checklist.clear(['q1']);

    expect(checklist.isTicked('q1')).toBe(false);
    expect(checklist.tickedAmong(OFFERED)).toEqual([
      { activityId: 'q2', notes: 'دوباره بررسی شود' },
    ]);
  });
});
