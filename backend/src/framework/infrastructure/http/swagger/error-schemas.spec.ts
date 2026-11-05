import { DEPENDENT_KINDS } from '../../../application/dependents/record-reference';
import { RecordHasDependentsSchema } from './error-schemas';

// The frontend's client is generated from these enums, so a kind missing
// here is a kind its types cannot name.
describe('RecordHasDependentsSchema', () => {
  it('documents every dependent kind, in the order a refusal lists them', () => {
    const { dependents } = RecordHasDependentsSchema.properties as unknown as {
      dependents: { items: { properties: { kind: { enum: string[] } } } };
    };

    expect(dependents.items.properties.kind.enum).toEqual([...DEPENDENT_KINDS]);
  });
});
