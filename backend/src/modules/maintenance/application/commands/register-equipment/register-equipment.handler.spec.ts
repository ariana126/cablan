import { EquipmentNameTaken } from '@maintenance/application/exceptions';
import { InMemoryEquipmentRepository } from '@maintenance/application/support/in-memory-equipment-repository';
import { Equipment } from '@maintenance/domain/equipment.aggregate';
import { EquipmentRegistered } from '@maintenance/domain/events/equipment-registered.event';
import { EquipmentName } from '@maintenance/domain/value/equipment-name.vo';

import { RegisterEquipmentCommand } from './register-equipment.command';
import { RegisterEquipmentHandler } from './register-equipment.handler';

const name = (value: string) => EquipmentName.fromString(value);

function makeSut() {
  const equipmentRepository = new InMemoryEquipmentRepository();
  const sut = new RegisterEquipmentHandler(equipmentRepository);
  return { sut, equipmentRepository };
}

describe('RegisterEquipmentHandler', () => {
  it('registers equipment by name alone', async () => {
    const { sut, equipmentRepository } = makeSut();

    const result = await sut.execute(
      new RegisterEquipmentCommand(name('اکسترودر')),
    );

    const saved = await equipmentRepository.findByName(name('اکسترودر'));
    expect(result).toEqual({ id: saved?.id.asString() });
    expect(saved?.isRetired()).toBe(false);
    expect(equipmentRepository.savedEvents).toEqual([
      new EquipmentRegistered(result.id, 'اکسترودر'),
    ]);
  });

  it('refuses a name already taken', async () => {
    const { sut, equipmentRepository } = makeSut();
    equipmentRepository.seed(Equipment.register(name('اکسترودر')));

    await expect(
      sut.execute(new RegisterEquipmentCommand(name('اکسترودر'))),
    ).rejects.toBeInstanceOf(EquipmentNameTaken);
  });

  it('refuses the name of retired equipment too', async () => {
    const { sut, equipmentRepository } = makeSut();
    const retired = Equipment.register(name('اکسترودر'));
    retired.retire(new Date('2026-07-01T06:00:00.000Z'));
    equipmentRepository.seed(retired);

    await expect(
      sut.execute(new RegisterEquipmentCommand(name('اکسترودر'))),
    ).rejects.toBeInstanceOf(EquipmentNameTaken);
  });
});
