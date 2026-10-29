import { EntityNotFound, Identity } from '@framework/domain';
import { EquipmentNameTaken } from '@maintenance/application/exceptions';
import { InMemoryEquipmentRepository } from '@maintenance/application/support/in-memory-equipment-repository';
import { Equipment } from '@maintenance/domain/equipment.aggregate';
import { EquipmentRenamed } from '@maintenance/domain/events/equipment-renamed.event';
import { EquipmentName } from '@maintenance/domain/value/equipment-name.vo';

import { RenameEquipmentCommand } from './rename-equipment.command';
import { RenameEquipmentHandler } from './rename-equipment.handler';

const name = (value: string) => EquipmentName.fromString(value);

function makeSut() {
  const equipmentRepository = new InMemoryEquipmentRepository();
  const sut = new RenameEquipmentHandler(equipmentRepository);
  const press = equipmentRepository.seed(Equipment.register(name('پرس')));
  return { sut, equipmentRepository, press };
}

describe('RenameEquipmentHandler', () => {
  it('renames equipment', async () => {
    const { sut, equipmentRepository, press } = makeSut();

    await sut.execute(
      new RenameEquipmentCommand(press.id, name('پرس هیدرولیک')),
    );

    const renamed = await equipmentRepository.get(press.id);
    expect(renamed.name().asString()).toBe('پرس هیدرولیک');
    expect(equipmentRepository.savedEvents).toEqual([
      new EquipmentRenamed(press.id.asString(), 'پرس', 'پرس هیدرولیک'),
    ]);
  });

  it('accepts equipment keeping its own name', async () => {
    const { sut, equipmentRepository, press } = makeSut();

    await sut.execute(new RenameEquipmentCommand(press.id, name('پرس')));

    expect(equipmentRepository.savedEvents).toEqual([]);
  });

  it('refuses a name another piece of equipment has', async () => {
    const { sut, equipmentRepository, press } = makeSut();
    equipmentRepository.seed(Equipment.register(name('اکسترودر')));

    await expect(
      sut.execute(new RenameEquipmentCommand(press.id, name('اکسترودر'))),
    ).rejects.toBeInstanceOf(EquipmentNameTaken);
  });

  it('refuses unknown equipment', async () => {
    const { sut } = makeSut();

    await expect(
      sut.execute(new RenameEquipmentCommand(Identity.new(), name('دیگر'))),
    ).rejects.toBeInstanceOf(EntityNotFound);
  });
});
