import { Identity } from '@framework/domain';

import { MaintenanceActivitySpecialtyAssigned } from '../events/maintenance-activity-specialty-assigned.event';
import { SpecialtyAssignmentMismatch } from '../exceptions/specialty-assignment-mismatch.exception';
import { MaintenanceActivity } from '../maintenance-activity.aggregate';
import { ActivitySpecialty } from '../value/activity-specialty.vo';
import { MaintenanceActivityName } from '../value/maintenance-activity-name.vo';
import { MissingSpecialties } from './missing-specialties';

const name = (value: string) => MaintenanceActivityName.fromString(value);
const electrical = ActivitySpecialty.electrical();
const mechanical = ActivitySpecialty.mechanical();

/** An activity registered before specialties existed. */
const withoutSpecialty = (activityName: string) =>
  MaintenanceActivity.fromPersistence(Identity.new(), name(activityName), null);

function arrange() {
  const oilChange = withoutSpecialty('تعویض روغن');
  const panelCheck = withoutSpecialty('بازرسی تابلو');
  const greasing = MaintenanceActivity.register(name('گریس کاری'), mechanical);
  greasing.releaseEvents();
  const sut = MissingSpecialties.in([oilChange, greasing, panelCheck]);
  return { sut, oilChange, panelCheck, greasing };
}

function refusalOf(work: () => unknown): SpecialtyAssignmentMismatch {
  try {
    work();
  } catch (error) {
    if (error instanceof SpecialtyAssignmentMismatch) {
      return error;
    }
    throw error;
  }
  throw new Error('expected a SpecialtyAssignmentMismatch');
}

describe('MissingSpecialties', () => {
  it('gives every activity without a specialty the one assigned to it, returning them in the order assigned', () => {
    const { sut, oilChange, panelCheck } = arrange();

    const completed = sut.complete([
      { activityId: panelCheck.id, specialty: electrical },
      { activityId: oilChange.id, specialty: mechanical },
    ]);

    expect(completed).toEqual([panelCheck, oilChange]);
    expect(oilChange.specialty()).toEqual(mechanical);
    expect(panelCheck.releaseEvents()).toEqual([
      new MaintenanceActivitySpecialtyAssigned(
        panelCheck.id.asString(),
        'بازرسی تابلو',
        'electrical',
      ),
    ]);
  });

  it('refuses leaving an activity without a specialty, changing none', () => {
    const { sut, oilChange, panelCheck } = arrange();

    const refusal = refusalOf(() =>
      sut.complete([{ activityId: oilChange.id, specialty: mechanical }]),
    );

    expect(refusal.missingActivityIds).toEqual([panelCheck.id.asString()]);
    expect(refusal.unexpectedActivityIds).toEqual([]);
    expect(oilChange.specialty()).toBeNull();
    expect(oilChange.releaseEvents()).toEqual([]);
  });

  it('refuses naming an activity that already has a specialty, changing none', () => {
    const { sut, oilChange, panelCheck, greasing } = arrange();

    const refusal = refusalOf(() =>
      sut.complete([
        { activityId: oilChange.id, specialty: mechanical },
        { activityId: panelCheck.id, specialty: electrical },
        { activityId: greasing.id, specialty: electrical },
      ]),
    );

    expect(refusal.missingActivityIds).toEqual([]);
    expect(refusal.unexpectedActivityIds).toEqual([greasing.id.asString()]);
    expect(greasing.specialty()).toEqual(mechanical);
    expect(oilChange.specialty()).toBeNull();
  });

  it('refuses naming an activity not in the catalog', () => {
    const { sut, oilChange, panelCheck } = arrange();
    const unknown = Identity.new();

    const refusal = refusalOf(() =>
      sut.complete([
        { activityId: oilChange.id, specialty: mechanical },
        { activityId: panelCheck.id, specialty: electrical },
        { activityId: unknown, specialty: electrical },
      ]),
    );

    expect(refusal.unexpectedActivityIds).toEqual([unknown.asString()]);
  });

  it('refuses naming one activity twice, changing none', () => {
    const { sut, oilChange, panelCheck } = arrange();

    const refusal = refusalOf(() =>
      sut.complete([
        { activityId: oilChange.id, specialty: mechanical },
        { activityId: oilChange.id, specialty: electrical },
        { activityId: panelCheck.id, specialty: electrical },
      ]),
    );

    expect(refusal.unexpectedActivityIds).toEqual([oilChange.id.asString()]);
    expect(oilChange.specialty()).toBeNull();
  });

  it('accepts an empty assignment once every activity has a specialty', () => {
    const greasing = MaintenanceActivity.register(
      name('گریس کاری'),
      mechanical,
    );

    expect(MissingSpecialties.in([greasing]).complete([])).toEqual([]);
  });
});
