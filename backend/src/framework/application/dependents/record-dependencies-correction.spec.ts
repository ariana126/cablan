import { Role } from '@framework/domain';

import { StubCorrectionPropagator } from '../support/stub-correction-propagator';
import { StubDependentsProbe } from '../support/stub-dependents-probe';
import { ApplyToRelatedRecords } from './apply-to-related-records';
import { EditOfRecordInUse, RecordDependencies } from './record-dependencies';
import { RecordHasDependents } from './record-has-dependents.exception';
import { RecordReference } from './record-reference';

const material: RecordReference = { type: 'Material', id: 'material-1' };
const granted = ApplyToRelatedRecords.askedBy(Role.SystemAdmin, true);
const notGranted = ApplyToRelatedRecords.askedBy(Role.Management, true);

function referencedMaterial(): StubDependentsProbe {
  return new StubDependentsProbe().given(material, [
    { kind: 'product', name: 'کابل NYY' },
  ]);
}

function anEdit(overrides: Partial<EditOfRecordInUse> = {}): EditOfRecordInUse {
  return {
    applyToRelatedRecords: granted,
    changesOnlyCorrectableFields: true,
    before: { name: 'مس', code: 'RM-1' },
    after: { name: 'مس قرمز', code: 'RM-2' },
    ...overrides,
  };
}

function makeSut(probe = referencedMaterial()) {
  const propagator = new StubCorrectionPropagator();
  const writes: string[] = [];
  const sut = new RecordDependencies([probe], [propagator]);
  const write = () => {
    writes.push('written');
    return Promise.resolve();
  };
  return { sut, propagator, writes, write };
}

describe('RecordDependencies — editing a record that may be in use (issue #110)', () => {
  it('writes a granted correction of a record in use, then carries it into every related record', async () => {
    const { sut, propagator, writes, write } = makeSut();

    await sut.editRecordInUse(material, anEdit(), write);

    expect(writes).toEqual(['written']);
    expect(propagator.propagated).toEqual([
      { reference: material, correction: { name: 'مس قرمز', code: 'RM-2' } },
    ]);
  });

  // A record whose referrers find it by its name — an order's daily BOMs, by
  // its number (issue #101) — needs the name they still hold.
  it('tells each propagator the fields as they stood before the correction', async () => {
    const { sut, propagator, write } = makeSut();

    await sut.editRecordInUse(material, anEdit(), write);

    expect(propagator.previousFields).toEqual([{ name: 'مس', code: 'RM-1' }]);
  });

  it('carries only the fields that changed', async () => {
    const { sut, propagator, write } = makeSut();

    await sut.editRecordInUse(
      material,
      anEdit({ after: { name: 'مس', code: 'RM-2' } }),
      write,
    );

    expect(propagator.propagated.map(({ correction }) => correction)).toEqual([
      { code: 'RM-2' },
    ]);
  });

  it('carries nothing when nothing changed', async () => {
    const { sut, propagator, write } = makeSut();

    await sut.editRecordInUse(
      material,
      anEdit({ after: { name: 'مس', code: 'RM-1' } }),
      write,
    );

    expect(propagator.propagated).toEqual([]);
  });

  it.each([
    [
      'a correction that also changes another field',
      { changesOnlyCorrectableFields: false },
    ],
    [
      'an edit whose correction is not granted',
      { applyToRelatedRecords: notGranted },
    ],
    [
      'an edit that asks for no correction',
      { applyToRelatedRecords: ApplyToRelatedRecords.notAsked() },
    ],
  ])(
    'refuses %s of a record in use, writing nothing',
    async (_label, overrides) => {
      const { sut, propagator, writes, write } = makeSut();

      await expect(
        sut.editRecordInUse(material, anEdit(overrides), write),
      ).rejects.toBeInstanceOf(RecordHasDependents);
      expect(writes).toEqual([]);
      expect(propagator.propagated).toEqual([]);
    },
  );

  it('writes an ordinary edit of a record nothing references, carrying nothing', async () => {
    const { sut, propagator, writes, write } = makeSut(
      new StubDependentsProbe(),
    );

    await sut.editRecordInUse(
      material,
      anEdit({
        applyToRelatedRecords: ApplyToRelatedRecords.notAsked(),
        changesOnlyCorrectableFields: false,
      }),
      write,
    );

    expect(writes).toEqual(['written']);
    expect(propagator.propagated).toEqual([]);
  });

  it('carries nothing when the write fails', async () => {
    const { sut, propagator } = makeSut();

    await expect(
      sut.editRecordInUse(material, anEdit(), () =>
        Promise.reject(new Error('name taken')),
      ),
    ).rejects.toThrow('name taken');
    expect(propagator.propagated).toEqual([]);
  });

  it('reads the propagators registered after it was built', async () => {
    const propagators: StubCorrectionPropagator[] = [];
    const sut = new RecordDependencies([], propagators);
    const propagator = new StubCorrectionPropagator();
    propagators.push(propagator);

    await sut.editRecordInUse(material, anEdit(), () => Promise.resolve());

    expect(propagator.propagated).toHaveLength(1);
  });
});
