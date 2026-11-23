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
