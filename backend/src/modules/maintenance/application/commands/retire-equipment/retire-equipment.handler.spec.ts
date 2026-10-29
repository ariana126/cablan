import { EntityNotFound, Identity } from '@framework/domain';
import { FixedClock } from '@maintenance/application/support/fixed-clock';
import { InMemoryEquipmentRepository } from '@maintenance/application/support/in-memory-equipment-repository';
import { Equipment } from '@maintenance/domain/equipment.aggregate';
import { EquipmentRetired } from '@maintenance/domain/events/equipment-retired.event';
import { EquipmentIsRetired } from '@maintenance/domain/exceptions/equipment-is-retired.exception';
import { EquipmentName } from '@maintenance/domain/value/equipment-name.vo';

import { RetireEquipmentCommand } from './retire-equipment.command';
import { RetireEquipmentHandler } from './retire-equipment.handler';

const NOW = new Date('2026-07-10T06:00:00.000Z');

function makeSut() {
  const equipmentRepository = new InMemoryEquipmentRepository();
  const sut = new RetireEquipmentHandler(
    equipmentRepository,
    new FixedClock(NOW),
  );
  const press = equipmentRepository.seed(
    Equipment.register(EquipmentName.fromString('پرس')),
  );
  return { sut, equipmentRepository, press };
}

describe('RetireEquipmentHandler', () => {
  it('retires equipment now', async () => {
    const { sut, equipmentRepository, press } = makeSut();

    await sut.execute(new RetireEquipmentCommand(press.id));

    const retired = await equipmentRepository.get(press.id);
    expect(retired.retiredAt()).toEqual(NOW);
    expect(equipmentRepository.savedEvents).toEqual([
      new EquipmentRetired(press.id.asString(), 'پرس'),
    ]);
  });

  it('refuses equipment already retired', async () => {
    const { sut, press } = makeSut();
    await sut.execute(new RetireEquipmentCommand(press.id));

    await expect(
      sut.execute(new RetireEquipmentCommand(press.id)),
    ).rejects.toBeInstanceOf(EquipmentIsRetired);
  });

  it('refuses unknown equipment', async () => {
    const { sut } = makeSut();

    await expect(
      sut.execute(new RetireEquipmentCommand(Identity.new())),
    ).rejects.toBeInstanceOf(EntityNotFound);
  });
});
