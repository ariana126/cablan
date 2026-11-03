import { ImmediateUnitOfWork } from '@framework/application/support/immediate-unit-of-work';
import { Identity } from '@framework/domain';
import { ACTIVITY_SPECIALTY_LOCK } from '@maintenance/application/service/activity-specialty-lock';
import { InMemoryMaintenanceActivityRepository } from '@maintenance/application/support/in-memory-maintenance-activity-repository';
import { MaintenanceActivitySpecialtyAssigned } from '@maintenance/domain/events/maintenance-activity-specialty-assigned.event';
import { SpecialtyAssignmentMismatch } from '@maintenance/domain/exceptions/specialty-assignment-mismatch.exception';
import { MaintenanceActivity } from '@maintenance/domain/maintenance-activity.aggregate';
import { ActivitySpecialty } from '@maintenance/domain/value/activity-specialty.vo';
import { MaintenanceActivityName } from '@maintenance/domain/value/maintenance-activity-name.vo';

import { CompleteMissingSpecialtiesCommand } from './complete-missing-specialties.command';
import { CompleteMissingSpecialtiesHandler } from './complete-missing-specialties.handler';

const name = (value: string) => MaintenanceActivityName.fromString(value);
const electrical = ActivitySpecialty.electrical();
const mechanical = ActivitySpecialty.mechanical();

async function specialtyOf(
  activityRepository: InMemoryMaintenanceActivityRepository,
  activity: MaintenanceActivity,
): Promise<string | null> {
  const stored = await activityRepository.get(activity.id);
  return stored.specialty()?.asString() ?? null;
}

function makeSut() {
  const activityRepository = new InMemoryMaintenanceActivityRepository();
  const unitOfWork = new ImmediateUnitOfWork();
  const sut = new CompleteMissingSpecialtiesHandler(
    activityRepository,
    unitOfWork,
  );
  // Registered before specialties existed.
  const withoutSpecialty = (activityName: string) =>
    activityRepository.seed(
      MaintenanceActivity.fromPersistence(
        Identity.new(),
        name(activityName),
        null,
      ),
    );
  const oilChange = withoutSpecialty('تعویض روغن');
  const panelCheck = withoutSpecialty('بازرسی تابلو');
  activityRepository.seed(
    MaintenanceActivity.register(name('گریس کاری'), mechanical),
  );
  return { sut, activityRepository, unitOfWork, oilChange, panelCheck };
}

describe('CompleteMissingSpecialtiesHandler', () => {
  it('saves every activity without a specialty with the one assigned to it, each recorded', async () => {
    const { sut, activityRepository, oilChange, panelCheck } = makeSut();

    await sut.execute(
      new CompleteMissingSpecialtiesCommand([
        { activityId: oilChange.id, specialty: mechanical },
        { activityId: panelCheck.id, specialty: electrical },
      ]),
    );

    expect(await specialtyOf(activityRepository, oilChange)).toBe('mechanical');
    expect(await specialtyOf(activityRepository, panelCheck)).toBe(
      'electrical',
    );
    expect(activityRepository.savedEvents).toEqual([
      new MaintenanceActivitySpecialtyAssigned(
        oilChange.id.asString(),
        'تعویض روغن',
        'mechanical',
      ),
      new MaintenanceActivitySpecialtyAssigned(
        panelCheck.id.asString(),
        'بازرسی تابلو',
        'electrical',
      ),
    ]);
  });

  it('saves nothing when the assignment does not name exactly the activities without a specialty', async () => {
    const { sut, activityRepository, oilChange } = makeSut();

    await expect(
      sut.execute(
        new CompleteMissingSpecialtiesCommand([
          { activityId: oilChange.id, specialty: mechanical },
        ]),
      ),
    ).rejects.toBeInstanceOf(SpecialtyAssignmentMismatch);
    expect(await specialtyOf(activityRepository, oilChange)).toBeNull();
    expect(activityRepository.savedEvents).toEqual([]);
  });

  it('holds the activity-specialty lock the general edit holds too', async () => {
    const { sut, unitOfWork, oilChange, panelCheck } = makeSut();

    await sut.execute(
      new CompleteMissingSpecialtiesCommand([
        { activityId: oilChange.id, specialty: mechanical },
        { activityId: panelCheck.id, specialty: electrical },
      ]),
    );

    expect(unitOfWork.lockKeysTaken()).toEqual([ACTIVITY_SPECIALTY_LOCK]);
  });
});
