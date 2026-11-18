import { Role } from '@framework/domain';

import { StubCompositionOrderPropagator } from '../support/stub-composition-order-propagator';
import { StubCorrectionPropagator } from '../support/stub-correction-propagator';
import { StubDependentsProbe } from '../support/stub-dependents-probe';
import { ApplyToRelatedRecords } from './apply-to-related-records';
import { EditOfRecordInUse, RecordDependencies } from './record-dependencies';
import { RecordHasDependents } from './record-has-dependents.exception';
import { RecordReference } from './record-reference';

const product: RecordReference = { type: 'Product', id: 'product-1' };
const granted = ApplyToRelatedRecords.askedBy(Role.SystemAdmin, true);
const newOrder = ['sheath', 'conductor', 'insulation'];

function productInUse(): StubDependentsProbe {
  return new StubDependentsProbe().given(product, [
    { kind: 'standard-bom', name: 'MI-100' },
  ]);
}

/** Management's edit giving the product's components in another order. */
function aReordering(
  overrides: Partial<EditOfRecordInUse> = {},
): EditOfRecordInUse {
  return {
    applyToRelatedRecords: ApplyToRelatedRecords.notAsked(),
    changesOnlyCorrectableFields: true,
    before: { name: 'کابل' },
    after: { name: 'کابل' },
    reorderedComposition: newOrder,
    ...overrides,
  };
}

function makeSut(probe = productInUse()) {
  const correctionPropagator = new StubCorrectionPropagator();
  const orderPropagator = new StubCompositionOrderPropagator();
  const writes: string[] = [];
  const sut = new RecordDependencies(
    [probe],
    [correctionPropagator],
    [orderPropagator],
  );
  const write = () => {
    writes.push('written');
    return Promise.resolve();
  };
  return { sut, correctionPropagator, orderPropagator, writes, write };
}

// Issue #122: reordering a product's components is allowed while it is in
// use — for anyone allowed to edit it — and the new order follows into every
// snapshot of its composition.
describe('RecordDependencies — reordering the composition of a record that may be in use (issue #122)', () => {
  it('writes a reordering of a record in use, then carries the new order into every related record', async () => {
    const { sut, orderPropagator, writes, write } = makeSut();

    await sut.editRecordInUse(product, aReordering(), write);

    expect(writes).toEqual(['written']);
    expect(orderPropagator.propagated).toEqual([
      { reference: product, orderedComponentIds: newOrder },
    ]);
  });

  it('carries no correction with a reordering alone', async () => {
    const { sut, correctionPropagator, write } = makeSut();

    await sut.editRecordInUse(product, aReordering(), write);

    expect(correctionPropagator.propagated).toEqual([]);
  });

  it('lets a reordering ride along with a granted correction, carrying both', async () => {
    const { sut, correctionPropagator, orderPropagator, write } = makeSut();

    await sut.editRecordInUse(
      product,
      aReordering({
        applyToRelatedRecords: granted,
        after: { name: 'کابل NYY' },
      }),
      write,
    );

    expect(correctionPropagator.propagated).toEqual([
      { reference: product, correction: { name: 'کابل NYY' } },
    ]);
    expect(orderPropagator.propagated).toEqual([
      { reference: product, orderedComponentIds: newOrder },
    ]);
  });

  it.each([
    [
      'a reordering that also renames it, without a granted correction',
      { after: { name: 'کابل NYY' } },
    ],
    [
      'a reordering that also changes the composition otherwise',
      { changesOnlyCorrectableFields: false },
    ],
  ])(
    'refuses %s of a record in use, writing and carrying nothing',
    async (_label, overrides) => {
      const { sut, orderPropagator, writes, write } = makeSut();

      await expect(
        sut.editRecordInUse(product, aReordering(overrides), write),
      ).rejects.toBeInstanceOf(RecordHasDependents);
      expect(writes).toEqual([]);
      expect(orderPropagator.propagated).toEqual([]);
    },
  );

  it('still refuses an edit of a record in use that changes nothing and reorders nothing', async () => {
    const { sut, write } = makeSut();

    await expect(
      sut.editRecordInUse(
        product,
        aReordering({ reorderedComposition: undefined }),
        write,
      ),
    ).rejects.toBeInstanceOf(RecordHasDependents);
  });

  it('carries no order when the write fails', async () => {
    const { sut, orderPropagator } = makeSut();

    await expect(
      sut.editRecordInUse(product, aReordering(), () =>
        Promise.reject(new Error('refused')),
      ),
    ).rejects.toThrow('refused');
    expect(orderPropagator.propagated).toEqual([]);
  });

  it('carries no order for an edit that reorders nothing', async () => {
    const { sut, orderPropagator, write } = makeSut(new StubDependentsProbe());

    await sut.editRecordInUse(
      product,
      aReordering({
        reorderedComposition: undefined,
        changesOnlyCorrectableFields: false,
      }),
      write,
    );

    expect(orderPropagator.propagated).toEqual([]);
  });
});
