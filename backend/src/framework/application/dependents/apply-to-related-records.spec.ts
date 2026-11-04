import { Role } from '@framework/domain';

import { ApplyToRelatedRecords } from './apply-to-related-records';

describe('ApplyToRelatedRecords', () => {
  it('is granted to a System Admin who asked for it', () => {
    expect(
      ApplyToRelatedRecords.askedBy(Role.SystemAdmin, true).isGranted(),
    ).toBe(true);
  });

  it('is not granted to a System Admin who did not ask', () => {
    expect(
      ApplyToRelatedRecords.askedBy(Role.SystemAdmin, false).isGranted(),
    ).toBe(false);
  });

  it.each([
    Role.Management,
    Role.QcInspector,
    Role.Reporter,
    Role.TechnicalManager,
    Role.PmInspector,
  ])('is silently not granted to %s, who asked for it', (role) => {
    expect(ApplyToRelatedRecords.askedBy(role, true).isGranted()).toBe(false);
  });

  it('is not granted to a caller whose role is unknown', () => {
    expect(ApplyToRelatedRecords.askedBy(null, true).isGranted()).toBe(false);
  });

  it('is not granted when nobody asked', () => {
    expect(ApplyToRelatedRecords.notAsked().isGranted()).toBe(false);
  });
});
