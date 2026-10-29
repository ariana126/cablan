import { MaintenanceActivityName } from './maintenance-activity-name.vo';

describe('MaintenanceActivityName', () => {
  it('is the name with its surrounding blanks trimmed', () => {
    expect(MaintenanceActivityName.fromString('  تعویض روغن ').asString()).toBe(
      'تعویض روغن',
    );
  });

  it.each(['', ' '.repeat(3)])('rejects the blank name %p', (name) => {
    expect(() => MaintenanceActivityName.fromString(name)).toThrow();
  });

  it('stores Persian digits as English ones', () => {
    expect(MaintenanceActivityName.fromString('سرویس ۵۰۰').asString()).toBe(
      'سرویس 500',
    );
  });
});
