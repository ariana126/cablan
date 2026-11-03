import { describe, expect, it } from 'vitest';

import { groupBySpecialty, toActivitySpecialty } from './specialty-groups';

interface Item {
  readonly name: string;
  readonly specialty: 'electrical' | 'mechanical' | null;
}

const item = (name: string, specialty: Item['specialty']): Item => ({ name, specialty });

describe('groupBySpecialty', () => {
  it('puts electrical first, then mechanical, then the unassigned, keeping the given order inside each', () => {
    const groups = groupBySpecialty(
      [
        item('روغن', 'mechanical'),
        item('بی‌تخصص', null),
        item('تابلو', 'electrical'),
        item('یاتاقان', 'mechanical'),
      ],
      (each) => each.specialty,
    );

    expect(groups.map((group) => [group.label, group.items.map((each) => each.name)])).toEqual([
      ['برق', ['تابلو']],
      ['مکانیک', ['روغن', 'یاتاقان']],
      ['تخصص تعیین نشده', ['بی‌تخصص']],
    ]);
    expect(groups.map((group) => group.specialty)).toEqual(['electrical', 'mechanical', null]);
  });

  it('leaves out a specialty with nothing in it', () => {
    const groups = groupBySpecialty([item('روغن', 'mechanical')], (each) => each.specialty);

    expect(groups.map((group) => group.label)).toEqual(['مکانیک']);
  });

  it('has no group at all for no items', () => {
    expect(groupBySpecialty([], () => null)).toEqual([]);
  });
});

describe('toActivitySpecialty', () => {
  it('keeps a known specialty and reads anything else as none', () => {
    expect(toActivitySpecialty('electrical')).toBe('electrical');
    expect(toActivitySpecialty('mechanical')).toBe('mechanical');
    expect(toActivitySpecialty(null)).toBeNull();
    expect(toActivitySpecialty(undefined)).toBeNull();
    expect(toActivitySpecialty('hydraulic')).toBeNull();
  });
});
