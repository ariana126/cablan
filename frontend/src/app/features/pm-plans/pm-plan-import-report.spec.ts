import { describe, expect, it } from 'vitest';

import { addableLine, addedLine, cellValue, differenceLabel } from './pm-plan-import-report';

describe('the PM plan import report, in words', () => {
  it('says how many plan rows the file can add, in Persian digits', () => {
    expect(addableLine(2)).toBe('۲ برنامه قابل ثبت است');
    expect(addableLine(0)).toBe('۰ برنامه قابل ثبت است');
  });

  it('says how many plan rows the import added', () => {
    expect(addedLine(12)).toBe('۱۲ برنامه ثبت شد.');
  });

  it.each([
    [['intervalDays'], 'دوره'],
    [['firstDueDate'], 'اولین موعد'],
    [['intervalDays', 'firstDueDate'], 'دوره و اولین موعد'],
    [['firstDueDate', 'intervalDays'], 'دوره و اولین موعد'],
  ] as const)('names the difference %j as «%s»', (differences, label) => {
    expect(differenceLabel(differences)).toBe(label);
  });

  it('draws an empty cell as a dash and keeps any other value as the file has it', () => {
    expect(cellValue('')).toBe('—');
    expect(cellValue('  ')).toBe('—');
    expect(cellValue('1405/13/01')).toBe('1405/13/01');
  });
});
