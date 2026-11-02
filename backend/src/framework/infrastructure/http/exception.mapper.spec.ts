// Loaded first, for its side effect: the framework barrel pulls in
// `HttpExceptionFilter`, which instantiates every module's mapper. Entering
// that cycle from the mapper under test instead leaves the mapper undefined
// when the filter reaches it.
import '@framework/infrastructure';

import { RecordHasDependents } from '@framework/application';

import { FrameworkExceptionMapper } from './exception.mapper';

describe('FrameworkExceptionMapper', () => {
  it('maps a record that has dependents to 409 record-has-dependents', () => {
    const sut = new FrameworkExceptionMapper();
    const exception = RecordHasDependents.of(
      { type: 'Material', id: 'material-1' },
      [
        { kind: 'product', count: 1, names: ['کابل NYY'] },
        { kind: 'standard-bom', count: 1, names: ['MI-100'] },
      ],
    );

    expect(sut.canMap(exception)).toBe(true);
    expect(sut.toProblemDetail(exception).asResponseBody()).toEqual({
      type: 'https://my-api-doc.dev/problems/record-has-dependents',
      title: 'Record has dependents',
      status: 409,
      detail:
        'Material material-1 cannot be edited or deleted: it is referenced by 1 product, 1 standard-bom.',
      recordType: 'Material',
      dependents: [
        { kind: 'product', count: 1, names: ['کابل NYY'] },
        { kind: 'standard-bom', count: 1, names: ['MI-100'] },
      ],
    });
  });
});
