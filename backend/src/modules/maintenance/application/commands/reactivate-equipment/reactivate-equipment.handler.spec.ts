import { ImmediateUnitOfWork } from '@framework/application/support/immediate-unit-of-work';
import { EntityNotFound, Identity } from '@framework/domain';
import { tehranMorningOf } from '@maintenance/application/support/fixed-clock';
import { MaintenanceWorld } from '@maintenance/application/support/maintenance-world';
import { EquipmentReactivated } from '@maintenance/domain/events/equipment-reactivated.event';
import { EquipmentNotRetired } from '@maintenance/domain/exceptions/equipment-not-retired.exception';
import { ReactivationFirstDueDateInPast } from '@maintenance/domain/exceptions/reactivation-first-due-date-in-past.exception';
import { CalendarDate } from '@maintenance/domain/value/calendar-date.vo';

import { ReactivateEquipmentCommand } from './reactivate-equipment.command';
import { ReactivateEquipmentHandler } from './reactivate-equipment.handler';

const date = (value: string) => CalendarDate.fromString(value);

/** «اکسترودر» oil change every 7 days from 07/01, retired 07/10; today 07/20. */
function makeSut() {
  const world = new MaintenanceWorld('2026-07-20');
  const sut = new ReactivateEquipmentHandler(
    world.equipmentRepository,
    world.clock,
    new ImmediateUnitOfWork(),
  );
  const extruder = world.equipment('اکسترودر');
  const item = world.planItem(
    extruder,
    world.activity('تعویض روغن'),
    7,
    '2026-07-01',
  );
  extruder.retire(tehranMorningOf('2026-07-10'));
  extruder.releaseEvents();
  return { world, sut, extruder, item };
}

describe('ReactivateEquipmentHandler', () => {
  it('reactivates retired equipment today, each row continuing its calendar', async () => {
    const { world, sut, extruder, item } = makeSut();

    await sut.execute(new ReactivateEquipmentCommand(extruder.id, []));

    const reactivated = await world.equipmentRepository.get(extruder.id);
    expect(reactivated.isRetired()).toBe(false);
    expect(
      reactivated
        .occurrencesInForceOf(reactivated.planItem(item.id), [])
        .nextDueDate(date('2026-07-20'))
        .asString(),
    ).toBe('2026-07-22');
    expect(world.equipmentRepository.savedEvents).toEqual([
      new EquipmentReactivated(extruder.id.asString(), 'اکسترودر', []),
    ]);
  });

  it('restarts a rescheduled row from its new first due date', async () => {
    const { world, sut, extruder, item } = makeSut();

    await sut.execute(
      new ReactivateEquipmentCommand(extruder.id, [
        { planItemId: item.id, firstDueDate: date('2026-07-25') },
      ]),
    );

    const reactivated = await world.equipmentRepository.get(extruder.id);
    expect(
      reactivated
        .occurrencesInForceOf(reactivated.planItem(item.id), [])
        .nextDueDate(date('2026-07-20'))
        .asString(),
    ).toBe('2026-07-25');
  });

  it('refuses a new first due date before today, saving nothing', async () => {
    const { world, sut, extruder, item } = makeSut();

    await expect(
      sut.execute(
        new ReactivateEquipmentCommand(extruder.id, [
          { planItemId: item.id, firstDueDate: date('2026-07-18') },
        ]),
      ),
    ).rejects.toBeInstanceOf(ReactivationFirstDueDateInPast);
    expect(extruder.isRetired()).toBe(true);
    expect(world.equipmentRepository.savedEvents).toEqual([]);
  });

  it('refuses equipment in service', async () => {
    const { world, sut } = makeSut();
    const press = world.equipment('پرس');

    await expect(
      sut.execute(new ReactivateEquipmentCommand(press.id, [])),
    ).rejects.toBeInstanceOf(EquipmentNotRetired);
  });

  it('refuses unknown equipment', async () => {
    const { sut } = makeSut();

    await expect(
      sut.execute(new ReactivateEquipmentCommand(Identity.new(), [])),
    ).rejects.toBeInstanceOf(EntityNotFound);
  });
});
