import {
  AuditSnapshot,
  compositionReplacementChanges,
  materialWeightChanges,
} from './audit-snapshot';

describe('AuditSnapshot', () => {
  it('a registration shows every field as newly set, in the order given', () => {
    const sut = AuditSnapshot.of({ name: 'Copper', code: 'RM-001' });

    expect(sut.asRegistration()).toEqual([
      { field: 'name', previousValue: '', newValue: 'Copper' },
      { field: 'code', previousValue: '', newValue: 'RM-001' },
    ]);
  });

  it('a deletion shows every field as it stood, cleared', () => {
    const sut = AuditSnapshot.of({ name: 'Copper', code: 'RM-001' });

    expect(sut.asDeletion()).toEqual([
      { field: 'name', previousValue: 'Copper', newValue: '' },
      { field: 'code', previousValue: 'RM-001', newValue: '' },
    ]);
  });

  it('numbers and booleans read as text', () => {
    const sut = AuditSnapshot.of({ standardLength: 305.5, active: false });

    expect(sut.asRegistration()).toEqual([
      { field: 'standardLength', previousValue: '', newValue: '305.5' },
      { field: 'active', previousValue: '', newValue: 'false' },
    ]);
  });

  it('a field with no value is left out', () => {
    const sut = AuditSnapshot.of({
      name: 'Copper',
      code: null,
      description: undefined,
      note: '',
    });

    expect(sut.asRegistration()).toEqual([
      { field: 'name', previousValue: '', newValue: 'Copper' },
    ]);
  });

  it('each component reads as one line after the fields, naming its materials and their weights', () => {
    const sut = AuditSnapshot.of({ miCode: '1001' }, [
      {
        name: 'Core',
        materials: [
          { name: 'Copper', weightInGrams: 12.5 },
          { name: 'PVC', weightInGrams: 3 },
        ],
      },
      { name: 'Jacket', materials: [{ name: 'PE', weightInGrams: 7 }] },
    ]);

    expect(sut.asRegistration()).toEqual([
      { field: 'miCode', previousValue: '', newValue: '1001' },
      {
        field: 'component',
        previousValue: '',
        newValue: 'Core: Copper (12.5 گرم)، PVC (3 گرم)',
      },
      { field: 'component', previousValue: '', newValue: 'Jacket: PE (7 گرم)' },
    ]);
  });

  it('a component whose materials carry no weight lists just their names', () => {
    const sut = AuditSnapshot.of({ name: 'Cat6' }, [
      { name: 'Core', materials: [{ name: 'Copper' }, { name: 'PVC' }] },
    ]);

    expect(sut.asDeletion()).toEqual([
      { field: 'name', previousValue: 'Cat6', newValue: '' },
      { field: 'component', previousValue: 'Core: Copper، PVC', newValue: '' },
    ]);
  });
});

describe('compositionReplacementChanges', () => {
  const core = {
    name: 'Core',
    materials: [{ name: 'Copper', weightInGrams: 12 }],
  };
  const jacket = {
    name: 'Jacket',
    materials: [{ name: 'PE', weightInGrams: 7 }],
  };

  it('a component whose materials changed reads before and after', () => {
    const changes = compositionReplacementChanges(
      [core, jacket],
      [core, { name: 'Jacket', materials: [{ name: 'PE', weightInGrams: 9 }] }],
    );

    expect(changes).toEqual([
      {
        field: 'component',
        previousValue: 'Jacket: PE (7 گرم)',
        newValue: 'Jacket: PE (9 گرم)',
      },
    ]);
  });

  it('a removed component reads as cleared and an added one as newly set', () => {
    const changes = compositionReplacementChanges(
      [core, jacket],
      [
        core,
        { name: 'Shield', materials: [{ name: 'Foil', weightInGrams: 2 }] },
      ],
    );

    expect(changes).toEqual([
      { field: 'component', previousValue: 'Jacket: PE (7 گرم)', newValue: '' },
      {
        field: 'component',
        previousValue: '',
        newValue: 'Shield: Foil (2 گرم)',
      },
    ]);
  });

  it('components sharing a name are paired in order of appearance', () => {
    const changes = compositionReplacementChanges(
      [core, { name: 'Core', materials: [{ name: 'Tin', weightInGrams: 1 }] }],
      [core, { name: 'Core', materials: [{ name: 'Tin', weightInGrams: 2 }] }],
    );

    expect(changes).toEqual([
      {
        field: 'component',
        previousValue: 'Core: Tin (1 گرم)',
        newValue: 'Core: Tin (2 گرم)',
      },
    ]);
  });

  it('a composition merely reordered still lists every position before and after, so the entry is never empty', () => {
    const changes = compositionReplacementChanges(
      [core, jacket],
      [jacket, core],
    );

    expect(changes).toEqual([
      {
        field: 'component',
        previousValue: 'Core: Copper (12 گرم)',
        newValue: 'Jacket: PE (7 گرم)',
      },
      {
        field: 'component',
        previousValue: 'Jacket: PE (7 گرم)',
        newValue: 'Core: Copper (12 گرم)',
      },
    ]);
  });
});

describe('materialWeightChanges', () => {
  const before = [
    {
      name: 'مغزی',
      materials: [
        { name: 'مسی', weightInGrams: 3 },
        { name: 'قلع', weightInGrams: 1 },
      ],
    },
    { name: 'روکش', materials: [{ name: 'آلومینیوم', weightInGrams: 6 }] },
  ];

  it('a composition whose weights alone changed reads as one line per changed material, in composition order', () => {
    const changes = materialWeightChanges(before, [
      {
        name: 'مغزی',
        materials: [
          { name: 'مسی', weightInGrams: 2 },
          { name: 'قلع', weightInGrams: 1 },
        ],
      },
      { name: 'روکش', materials: [{ name: 'آلومینیوم', weightInGrams: 4.5 }] },
    ]);

    expect(changes).toEqual([
      {
        field: 'materialWeight:مغزی:مسی',
        previousValue: '3',
        newValue: '2',
      },
      {
        field: 'materialWeight:روکش:آلومینیوم',
        previousValue: '6',
        newValue: '4.5',
      },
    ]);
  });

  it('a composition that gained a material is not a weight-only change', () => {
    const changes = materialWeightChanges(before, [
      ...before,
      { name: 'پوشش', materials: [{ name: 'PE', weightInGrams: 7 }] },
    ]);

    expect(changes).toBeNull();
  });

  it('a composition whose material was swapped is not a weight-only change', () => {
    const changes = materialWeightChanges(before, [
      before[0],
      { name: 'روکش', materials: [{ name: 'PVC', weightInGrams: 6 }] },
    ]);

    expect(changes).toBeNull();
  });

  it('a composition merely reordered is not a weight-only change', () => {
    const changes = materialWeightChanges(before, [before[1], before[0]]);

    expect(changes).toBeNull();
  });

  it('a composition with no weight changed is not a weight-only change, so its entry is never empty', () => {
    const changes = materialWeightChanges(before, before);

    expect(changes).toBeNull();
  });
});
