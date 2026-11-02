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
