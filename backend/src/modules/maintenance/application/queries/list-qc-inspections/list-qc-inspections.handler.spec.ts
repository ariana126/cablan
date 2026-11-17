import { QcEquipmentStatuses } from '@maintenance/application/service/qc-equipment-statuses';
import { MaintenanceWorld } from '@maintenance/application/support/maintenance-world';

import { ListQcInspectionsHandler } from './list-qc-inspections.handler';

const AT_08_00 = new Date('2026-09-23T04:30:00.000Z');

describe('ListQcInspectionsHandler', () => {
  it('lists the equipment in service that has QC activities, by Persian name, each activity with its last execution', async () => {
    const world = new MaintenanceWorld('2026-09-23');
    const sut = new ListQcInspectionsHandler(
      world.equipmentRepository,
      new QcEquipmentStatuses(
        world.qcActivityRepository,
        world.qcExecutionReader,
      ),
    );
    const dimensional = world.qcActivity('بازرسی ابعادی');
    const second = world.equipment('اکسترودر 2');
    const first = world.equipment('اکسترودر 1');
    const retired = world.equipment('پرس');
    world.equipment('بالمیکسر');
    world.qcAssigned(first, dimensional);
    world.qcAssigned(second, dimensional);
    world.qcAssigned(retired, dimensional);
    retired.retire(world.clock.now());
    world.qcRecorded(second, dimensional, AT_08_00);

    expect(await sut.execute()).toEqual([
      {
        id: first.id.asString(),
        name: 'اکسترودر 1',
        retired: false,
        activities: [
          {
            activityId: dimensional.id.asString(),
            activityName: 'بازرسی ابعادی',
            lastPerformedAt: null,
          },
        ],
      },
      {
        id: second.id.asString(),
        name: 'اکسترودر 2',
        retired: false,
        activities: [
          {
            activityId: dimensional.id.asString(),
            activityName: 'بازرسی ابعادی',
            lastPerformedAt: AT_08_00.toISOString(),
          },
        ],
      },
    ]);
  });
});
