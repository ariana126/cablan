import {
  ACTIVITY_SPECIALTIES,
  ActivitySpecialty,
} from './activity-specialty.vo';

describe('ActivitySpecialty', () => {
  it.each(['electrical', 'mechanical'])('is %p', (value) => {
    expect(ActivitySpecialty.fromString(value).asString()).toBe(value);
  });

  it('names its two specialties for whoever validates one first', () => {
    expect(ACTIVITY_SPECIALTIES).toEqual(['electrical', 'mechanical']);
  });

  it.each(['', 'civil', 'Electrical', 'electrical,mechanical'])(
    'refuses %p',
    (value) => {
      expect(() => ActivitySpecialty.fromString(value)).toThrow();
    },
  );

  it('equals the same specialty', () => {
    expect(
      ActivitySpecialty.electrical().equals(
        ActivitySpecialty.fromString('electrical'),
      ),
    ).toBe(true);
    expect(
      ActivitySpecialty.electrical().equals(ActivitySpecialty.mechanical()),
    ).toBe(false);
  });
});
