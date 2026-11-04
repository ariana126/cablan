import {
  ApplyToRelatedRecords,
  RecordDependencies,
  RecordHasDependents,
} from '@framework/application';
import { ImmediateUnitOfWork } from '@framework/application/support/immediate-unit-of-work';
import { StubCorrectionPropagator } from '@framework/application/support/stub-correction-propagator';
import { StubDependentsProbe } from '@framework/application/support/stub-dependents-probe';
import { EntityNotFound, Identity, Role } from '@framework/domain';
import { EquipmentNameTaken } from '@maintenance/application/exceptions';
import { PM_SNAPSHOT_NAMES_LOCK } from '@maintenance/application/service/pm-snapshot-names-lock';
import { InMemoryEquipmentRepository } from '@maintenance/application/support/in-memory-equipment-repository';
import { Equipment } from '@maintenance/domain/equipment.aggregate';
import { EquipmentRenamed } from '@maintenance/domain/events/equipment-renamed.event';
import { EquipmentName } from '@maintenance/domain/value/equipment-name.vo';

import { RenameEquipmentCommand } from './rename-equipment.command';
import { RenameEquipmentHandler } from './rename-equipment.handler';

const name = (value: string) => EquipmentName.fromString(value);

function makeSut() {
  const equipmentRepository = new InMemoryEquipmentRepository();
  const probe = new StubDependentsProbe();
  const propagator = new StubCorrectionPropagator();
  const unitOfWork = new ImmediateUnitOfWork();
  const sut = new RenameEquipmentHandler(
    equipmentRepository,
    new RecordDependencies([probe], [propagator]),
    unitOfWork,
  );
  const press = equipmentRepository.seed(Equipment.register(name('پرس')));
  return { sut, equipmentRepository, press, probe, propagator, unitOfWork };
}

const reference = (press: Equipment) => ({
  type: 'Equipment' as const,
  id: press.id.asString(),
});

describe('RenameEquipmentHandler', () => {
  it('refuses renaming equipment whose PM plan holds items, leaving it unchanged', async () => {
    const { sut, equipmentRepository, press, probe } = makeSut();
    probe.given({ type: 'Equipment', id: press.id.asString() }, [
      { kind: 'equipment-pm-plan', name: 'پرس' },
    ]);

    await expect(
      sut.execute(new RenameEquipmentCommand(press.id, name('پرس هیدرولیک'))),
    ).rejects.toBeInstanceOf(RecordHasDependents);
    const kept = await equipmentRepository.get(press.id);
    expect(kept.name().asString()).toBe('پرس');
    expect(equipmentRepository.savedEvents).toEqual([]);
  });

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

  describe('the System Admin’s correction (issue #110)', () => {
    it('renames under the lock execution recording holds (reviewer M3)', async () => {
      const { sut, press, unitOfWork } = makeSut();

      await sut.execute(
        new RenameEquipmentCommand(press.id, name('پرس هیدرولیک'), admin),
      );

      expect(unitOfWork.lockKeysTaken()).toEqual([PM_SNAPSHOT_NAMES_LOCK]);
    });

    const admin = ApplyToRelatedRecords.askedBy(Role.SystemAdmin, true);

    it('renames equipment whose PM plan holds items, carrying the name into the history', async () => {
      const { sut, equipmentRepository, press, probe, propagator } = makeSut();
      probe.given(reference(press), [
        { kind: 'equipment-pm-plan', name: 'پرس' },
      ]);

      await sut.execute(
        new RenameEquipmentCommand(press.id, name('پرس هیدرولیک'), admin),
      );

      const reloaded = await equipmentRepository.get(press.id);
      expect(reloaded.name().asString()).toBe('پرس هیدرولیک');
      expect(equipmentRepository.savedEvents).toEqual([
        new EquipmentRenamed(press.id.asString(), 'پرس', 'پرس هیدرولیک'),
      ]);
      expect(propagator.propagated).toEqual([
        { reference: reference(press), correction: { name: 'پرس هیدرولیک' } },
      ]);
    });

    it('renames retired equipment, leaving it retired', async () => {
      const { sut, equipmentRepository, press } = makeSut();
      press.retire(new Date('2026-07-10T06:00:00.000Z'));

      await sut.execute(
        new RenameEquipmentCommand(press.id, name('پرس قدیمی'), admin),
      );

      const corrected = await equipmentRepository.get(press.id);
      expect(corrected.name().asString()).toBe('پرس قدیمی');
      expect(corrected.isRetired()).toBe(true);
    });

    it('is the ordinary refusal for anyone else who asks', async () => {
      const { sut, press, probe, propagator } = makeSut();
      probe.given(reference(press), [
        { kind: 'equipment-pm-plan', name: 'پرس' },
      ]);

      await expect(
        sut.execute(
          new RenameEquipmentCommand(
            press.id,
            name('پرس هیدرولیک'),
            ApplyToRelatedRecords.askedBy(Role.TechnicalManager, true),
          ),
        ),
      ).rejects.toBeInstanceOf(RecordHasDependents);
      expect(propagator.propagated).toEqual([]);
    });

    it('still refuses a name another piece of equipment has, changing nothing', async () => {
      const { sut, equipmentRepository, press, propagator } = makeSut();
      equipmentRepository.seed(Equipment.register(name('اکسترودر')));

      await expect(
        sut.execute(
          new RenameEquipmentCommand(press.id, name('اکسترودر'), admin),
        ),
      ).rejects.toBeInstanceOf(EquipmentNameTaken);
      expect(propagator.propagated).toEqual([]);
    });

    it('propagates nothing when the name is unchanged', async () => {
      const { sut, press, propagator } = makeSut();

      await sut.execute(
        new RenameEquipmentCommand(press.id, name('پرس'), admin),
      );

      expect(propagator.propagated).toEqual([]);
    });
  });
});
