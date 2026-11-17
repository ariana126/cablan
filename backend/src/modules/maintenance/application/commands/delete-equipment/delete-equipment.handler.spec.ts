import { ImmediateUnitOfWork } from '@framework/application/support/immediate-unit-of-work';
import { EntityNotFound, Identity } from '@framework/domain';
import { tehranMorningOf } from '@maintenance/application/support/fixed-clock';
import {
  MaintenanceWorld,
  NIKROOZ,
} from '@maintenance/application/support/maintenance-world';
import { EquipmentDeleted } from '@maintenance/domain/events/equipment-deleted.event';
import { QcExecutionDeleted } from '@maintenance/domain/events/qc-execution-deleted.event';
import { EquipmentNotRetired } from '@maintenance/domain/exceptions/equipment-not-retired.exception';
import { MaintenanceExecution } from '@maintenance/domain/maintenance-execution.aggregate';
import { CalendarDate } from '@maintenance/domain/value/calendar-date.vo';
import { EquipmentName } from '@maintenance/domain/value/equipment-name.vo';

import { DeleteEquipmentCommand } from './delete-equipment.command';
import { DeleteEquipmentHandler } from './delete-equipment.handler';

/**
 * «اکسترودر 1» and «اکسترودر 2», each with an oil change every 7 days from
 * 07/01, done on 07/01; «اکسترودر 1» also has an inactive row.
 */
function makeSut() {
  const world = new MaintenanceWorld('2026-07-20');
  const sut = new DeleteEquipmentHandler(
    world.equipmentRepository,
    world.executionRepository,
    world.qcActivityRepository,
    world.qcExecutionRepository,
    new ImmediateUnitOfWork(),
  );
  const oilChange = world.activity('تعویض روغن');
  const first = world.equipment('اکسترودر 1');
  const second = world.equipment('اکسترودر 2');
  const inactive = world.planItem(first, oilChange, 30, '2026-06-01');
  world.executed(first, inactive, '2026-06-01', tehranMorningOf('2026-06-01'));
  first.deactivatePlanItem(inactive.id, tehranMorningOf('2026-06-20'));
  const firstItem = world.planItem(first, oilChange, 7, '2026-07-01');
  const secondItem = world.planItem(second, oilChange, 7, '2026-07-01');
  world.executed(first, firstItem, '2026-07-01', tehranMorningOf('2026-07-01'));
  const kept = world.executed(
    second,
    secondItem,
    '2026-07-01',
    tehranMorningOf('2026-07-01'),
  );
  first.releaseEvents();
  return { world, sut, first, second, kept };
}

describe('DeleteEquipmentHandler', () => {
  it('deletes retired equipment with every row and every execution of it', async () => {
    const { world, sut, first, kept } = makeSut();
    first.retire(tehranMorningOf('2026-07-10'));
    first.releaseEvents();

    await sut.execute(new DeleteEquipmentCommand(first.id));

    expect(await world.equipmentRepository.find(first.id)).toBeNull();
    expect(world.executionRepository.all()).toEqual([kept]);
    expect(world.equipmentRepository.savedEvents).toEqual([
      new EquipmentDeleted(first.id.asString(), 'اکسترودر 1'),
    ]);
  });

  // Code review: an execution recorded concurrently, on a row this load did
  // not see, must not be left behind with no equipment.
  it('deletes every execution of the equipment, even one of a row it did not load', async () => {
    const { world, sut, first, kept } = makeSut();
    first.retire(tehranMorningOf('2026-07-10'));
    world.executionRepository.seed(
      MaintenanceExecution.record({
        equipmentId: first.id,
        equipmentName: 'اکسترودر 1',
        planItemId: Identity.new(),
        activityId: Identity.new(),
        activityName: 'گریس کاری',
        dueDate: CalendarDate.fromString('2026-07-01'),
        performedAt: tehranMorningOf('2026-07-01'),
        performedById: Identity.new(),
        performedByName: 'مسلمی',
        notes: null,
        operatingHours: null,
      }),
    );

    await sut.execute(new DeleteEquipmentCommand(first.id));

    expect(world.executionRepository.all()).toEqual([kept]);
  });

  it('frees its name', async () => {
    const { world, sut, first } = makeSut();
    first.retire(tehranMorningOf('2026-07-10'));

    await sut.execute(new DeleteEquipmentCommand(first.id));

    expect(
      await world.equipmentRepository.findByName(
        EquipmentName.fromString('اکسترودر 1'),
      ),
    ).toBeNull();
  });

  it('refuses equipment in service, deleting nothing', async () => {
    const { world, sut, first } = makeSut();
    const executions = world.executionRepository.all();

    await expect(
      sut.execute(new DeleteEquipmentCommand(first.id)),
    ).rejects.toBeInstanceOf(EquipmentNotRetired);
    expect(await world.equipmentRepository.find(first.id)).toBe(first);
    expect(world.executionRepository.all()).toEqual(executions);
  });

  describe('its production QC (issue #119)', () => {
    it('deletes its QC assignments and every QC record made on it, each record’s deletion recorded', async () => {
      const { world, sut, first, second } = makeSut();
      const dimensional = world.qcActivity('بازرسی ابعادی');
      const visual = world.qcActivity('بازرسی ظاهری');
      world.qcAssigned(first, dimensional, visual);
      world.qcAssigned(second, dimensional);
      const onFirst = world.qcRecorded(
        first,
        visual,
        tehranMorningOf('2026-07-02'),
      );
      const onSecond = world.qcRecorded(
        second,
        dimensional,
        tehranMorningOf('2026-07-02'),
      );
      first.retire(tehranMorningOf('2026-07-10'));
      first.releaseEvents();

      await sut.execute(new DeleteEquipmentCommand(first.id));

      expect(await world.equipmentRepository.find(first.id)).toBeNull();
      expect(world.qcExecutionRepository.all()).toEqual([onSecond]);
      expect(world.qcExecutionRepository.savedEvents).toEqual([
        new QcExecutionDeleted(
          onFirst.id.asString(),
          first.id.asString(),
          'اکسترودر 1',
          visual.id.asString(),
          'بازرسی ظاهری',
          tehranMorningOf('2026-07-02'),
          NIKROOZ.name,
          'TR-100',
        ),
      ]);
      expect(second.qcActivityIds()).toEqual([dimensional.id]);
    });

    it('deletes no QC record of equipment in service', async () => {
      const { world, sut, first } = makeSut();
      const dimensional = world.qcActivity('بازرسی ابعادی');
      world.qcAssigned(first, dimensional);
      const record = world.qcRecorded(
        first,
        dimensional,
        tehranMorningOf('2026-07-02'),
      );

      await expect(
        sut.execute(new DeleteEquipmentCommand(first.id)),
      ).rejects.toBeInstanceOf(EquipmentNotRetired);
      expect(world.qcExecutionRepository.all()).toEqual([record]);
    });
  });

  it('refuses unknown equipment', async () => {
    const { sut } = makeSut();

    await expect(
      sut.execute(new DeleteEquipmentCommand(Identity.new())),
    ).rejects.toBeInstanceOf(EntityNotFound);
  });
});
