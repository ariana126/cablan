import { StubDependentsProbe } from '../support/stub-dependents-probe';
import { RecordDependencies } from './record-dependencies';
import { RecordHasDependents } from './record-has-dependents.exception';
import { RecordReference } from './record-reference';

const material: RecordReference = { type: 'Material', id: 'material-1' };

describe('RecordDependencies', () => {
  it('finds no dependents when no probe answers for the record', async () => {
    const sut = new RecordDependencies([
      new StubDependentsProbe().given({ type: 'Material', id: 'other' }, [
        { kind: 'product', name: 'کابل NYY' },
      ]),
    ]);

    expect(await sut.dependentsOf(material)).toEqual([]);
  });

  it('counts the dependent records of each kind, names sorted', async () => {
    const sut = new RecordDependencies([
      new StubDependentsProbe().given(material, [
        { kind: 'product', name: 'کابل NYY' },
        { kind: 'product', name: 'کابل افشان' },
      ]),
    ]);

    expect(await sut.dependentsOf(material)).toEqual([
      { kind: 'product', count: 2, names: ['کابل افشان', 'کابل NYY'] },
    ]);
  });

  it("gathers every probe's answer, ordered by kind", async () => {
    const sut = new RecordDependencies([
      new StubDependentsProbe().given(material, [
        { kind: 'daily-bom', name: 'ORD-2' },
      ]),
      new StubDependentsProbe().given(material, [
        { kind: 'standard-bom', name: 'MI-100' },
      ]),
      new StubDependentsProbe().given(material, [
        { kind: 'product', name: 'کابل NYY' },
      ]),
    ]);

    expect(await sut.dependentsOf(material)).toEqual([
      { kind: 'product', count: 1, names: ['کابل NYY'] },
      { kind: 'standard-bom', count: 1, names: ['MI-100'] },
      { kind: 'daily-bom', count: 1, names: ['ORD-2'] },
    ]);
  });

  // Issue #101: a standard BOM is referenced by the orders assigning it as
  // well as by its daily BOMs; an order sits upstream of its daily BOMs.
  it('lists the orders referencing a record before its daily BOMs', async () => {
    const standardBom: RecordReference = { type: 'StandardBom', id: 'mi-1' };
    const sut = new RecordDependencies([
      new StubDependentsProbe().given(standardBom, [
        { kind: 'daily-bom', name: 'ORD-5001' },
        { kind: 'order', name: 'ORD-5001' },
      ]),
    ]);

    expect(await sut.dependentsOf(standardBom)).toEqual([
      { kind: 'order', count: 1, names: ['ORD-5001'] },
      { kind: 'daily-bom', count: 1, names: ['ORD-5001'] },
    ]);
  });

  it('answers for an order, referenced by its daily BOMs', async () => {
    const order: RecordReference = { type: 'order', id: 'order-1' };
    const sut = new RecordDependencies([
      new StubDependentsProbe().given(order, [
        { kind: 'daily-bom', name: 'ORD-5001' },
      ]),
    ]);

    await expect(sut.assertNoDependents(order)).rejects.toBeInstanceOf(
      RecordHasDependents,
    );
  });

  it('merges one kind answered by two probes', async () => {
    const sut = new RecordDependencies([
      new StubDependentsProbe().given(material, [
        { kind: 'daily-bom', name: 'ORD-2' },
      ]),
      new StubDependentsProbe().given(material, [
        { kind: 'daily-bom', name: 'ORD-1' },
      ]),
    ]);

    expect(await sut.dependentsOf(material)).toEqual([
      { kind: 'daily-bom', count: 2, names: ['ORD-1', 'ORD-2'] },
    ]);
  });

  it('keeps one name per dependent record, even when two share it', async () => {
    const sut = new RecordDependencies([
      new StubDependentsProbe().given(material, [
        { kind: 'product', name: 'کابل NYY' },
        { kind: 'product', name: 'کابل NYY' },
      ]),
    ]);

    expect(await sut.dependentsOf(material)).toEqual([
      { kind: 'product', count: 2, names: ['کابل NYY', 'کابل NYY'] },
    ]);
  });

  // Issue #119: a QC activity is referenced by the equipment it is assigned
  // to (named) and by its QC records (only counted).
  it('answers for a QC activity, its assignments named and its records counted unnamed, in kind order', async () => {
    const activity: RecordReference = { type: 'qc-activity', id: 'qc-1' };
    const sut = new RecordDependencies([
      new StubDependentsProbe().given(activity, [
        { kind: 'qc-activity-execution', name: null },
        { kind: 'qc-assigned-equipment', name: 'اکسترودر 2' },
        { kind: 'qc-activity-execution', name: null },
        { kind: 'qc-assigned-equipment', name: 'اکسترودر 1' },
      ]),
    ]);

    expect(await sut.dependentsOf(activity)).toEqual([
      {
        kind: 'qc-assigned-equipment',
        count: 2,
        names: ['اکسترودر 1', 'اکسترودر 2'],
      },
      { kind: 'qc-activity-execution', count: 2, names: [] },
    ]);
  });

  it('lists equipment’s QC dependents after its PM plan, its QC records counted unnamed', async () => {
    const equipment: RecordReference = { type: 'Equipment', id: 'eq-1' };
    const sut = new RecordDependencies([
      new StubDependentsProbe().given(equipment, [
        { kind: 'qc-equipment-execution', name: null },
        { kind: 'qc-assigned-activity', name: 'بازرسی ظاهری' },
        { kind: 'equipment-pm-plan', name: 'اکسترودر 1' },
        { kind: 'qc-assigned-activity', name: 'بازرسی ابعادی' },
      ]),
    ]);

    expect(await sut.dependentsOf(equipment)).toEqual([
      { kind: 'equipment-pm-plan', count: 1, names: ['اکسترودر 1'] },
      {
        kind: 'qc-assigned-activity',
        count: 2,
        names: ['بازرسی ابعادی', 'بازرسی ظاهری'],
      },
      { kind: 'qc-equipment-execution', count: 1, names: [] },
    ]);
  });

  it('reads the probes registered after it was built', async () => {
    const probes: StubDependentsProbe[] = [];
    const sut = new RecordDependencies(probes);
    probes.push(
      new StubDependentsProbe().given(material, [
        { kind: 'product', name: 'کابل NYY' },
      ]),
    );

    expect(await sut.dependentsOf(material)).toHaveLength(1);
  });

  describe('assertNoDependents', () => {
    it('lets a record nothing references through', async () => {
      const sut = new RecordDependencies([new StubDependentsProbe()]);

      await expect(sut.assertNoDependents(material)).resolves.toBeUndefined();
    });

    it('refuses a referenced record, naming the record and its dependents', async () => {
      const sut = new RecordDependencies([
        new StubDependentsProbe().given(material, [
          { kind: 'product', name: 'کابل NYY' },
          { kind: 'standard-bom', name: 'MI-100' },
        ]),
      ]);

      const refusal = await sut.assertNoDependents(material).then(
        () => null,
        (error: unknown) => error,
      );

      expect(refusal).toBeInstanceOf(RecordHasDependents);
      const exception = refusal as RecordHasDependents;
      expect(exception.reference).toEqual(material);
      expect(exception.dependents).toEqual([
        { kind: 'product', count: 1, names: ['کابل NYY'] },
        { kind: 'standard-bom', count: 1, names: ['MI-100'] },
      ]);
      expect(exception.message).toBe(
        'Material material-1 cannot be edited or deleted: it is referenced by 1 product, 1 standard-bom.',
      );
    });
  });
});
