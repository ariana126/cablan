import { EquipmentName } from './equipment-name.vo';

describe('EquipmentName', () => {
  it('is the name with its surrounding blanks trimmed', () => {
    expect(EquipmentName.fromString('  اکسترودر ۱  ').asString()).toBe(
      'اکسترودر 1',
    );
  });

  it.each(['', ' '.repeat(3)])('rejects the blank name %p', (name) => {
    expect(() => EquipmentName.fromString(name)).toThrow();
  });

  it('is equal to the same name typed with Persian digits', () => {
    expect(
      EquipmentName.fromString('دستگاه ۲').equals(
        EquipmentName.fromString('دستگاه 2'),
      ),
    ).toBe(true);
  });
});
