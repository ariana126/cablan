import { Identity } from '@framework/domain';
import {
  EquipmentNotFound,
  QcSubmissionMismatch,
} from '@maintenance/application/exceptions';
import { FixedClock } from '@maintenance/application/support/fixed-clock';
import { InMemoryQcExecutionRepository } from '@maintenance/application/support/in-memory-qc-execution-repository';
import { MaintenanceWorld } from '@maintenance/application/support/maintenance-world';
import { StubDisplayNameProvider } from '@maintenance/application/support/stub-display-name-provider';
import { QcExecutionRecorded } from '@maintenance/domain/events/qc-execution-recorded.event';
import { EquipmentIsRetired } from '@maintenance/domain/exceptions/equipment-is-retired.exception';
import { QcExecution } from '@maintenance/domain/qc-execution.aggregate';
import { QcTrackingNumber } from '@maintenance/domain/value/qc-tracking-number.vo';

import {
  QcActivityRecordingResult,
  QcExecutionsRecording,
} from './qc-executions-recording.result';
import {
  QcActivityToRecord,
  RecordQcExecutionsCommand,
} from './record-qc-executions.command';
import { RecordQcExecutionsHandler } from './record-qc-executions.handler';

const inspectorId = Identity.new();
const anotherInspectorId = Identity.new();
const TR_100 = QcTrackingNumber.fromString('TR-100');
const NOW = new Date('2026-09-23T05:30:00.000Z');
const LATER = new Date('2026-09-23T06:00:00.000Z');

/** A clock that moves on a minute each time it is read. */
class TickingClock extends FixedClock {
  private reads = 0;

  now(): Date {
    return new Date(super.now().getTime() + 60_000 * this.reads++);
  }
}

/**
 * A second sending of the same submission that the lookup does not see yet:
 * the other one is saved between this one's lookup and its save, as two
 * requests at once would.
 */
class RacedQcExecutionRepository extends InMemoryQcExecutionRepository {
  private theOtherSending: (() => QcExecution) | null = null;

  racedBy(theOtherSending: () => QcExecution): void {
    this.theOtherSending = theOtherSending;
  }

  async ofSubmission(submissionId: Identity): Promise<QcExecution[]> {
    if (this.theOtherSending) {
      this.seed(this.theOtherSending());
      this.theOtherSending = null;
      return [];
    }
    return super.ofSubmission(submissionId);
  }
}

function makeSut(
  options: {
    clock?: FixedClock;
    executionRepository?: InMemoryQcExecutionRepository;
  } = {},
) {
  const world = new MaintenanceWorld('2026-09-23');
  world.clock.set(NOW);
  const extruder = world.equipment('اکسترودر 1');
  const dimensional = world.qcActivity('بازرسی ابعادی');
  const visual = world.qcActivity('بازرسی ظاهری');
  const thickness = world.qcActivity('اندازه گیری ضخامت');
  world.qcAssigned(extruder, dimensional, visual, thickness);
  const executionRepository =
    options.executionRepository ?? world.qcExecutionRepository;
  const sut = new RecordQcExecutionsHandler(
    world.equipmentRepository,
    world.qcActivityRepository,
    executionRepository,
    options.clock ?? world.clock,
    new StubDisplayNameProvider()
      .name(inspectorId, 'نیکروش')
      .name(anotherInspectorId, 'مسلمی'),
  );
  return {
    world,
    sut,
    extruder,
    dimensional,
    visual,
    thickness,
    executionRepository,
  };
}

function submission(
  equipmentId: Identity,
  activities: QcActivityToRecord[],
  submissionId: Identity = Identity.new(),
): RecordQcExecutionsCommand {
  return new RecordQcExecutionsCommand(
    equipmentId,
    inspectorId,
    submissionId,
    TR_100,
    activities,
  );
}

/** Sends `command` each time it is called: the same submission, resent. */
function sameSubmissionEachTime(
  sut: RecordQcExecutionsHandler,
  command: RecordQcExecutionsCommand,
): () => Promise<QcExecutionsRecording> {
  return () => sut.execute(command);
}

function ticked(
  activity: { id: Identity },
  notes?: string,
): QcActivityToRecord {
  return { activityId: activity.id, notes };
}

describe('RecordQcExecutionsHandler', () => {
  it('records each ticked activity under one tracking number, instant and performer, with its own notes', async () => {
    const { sut, extruder, dimensional, visual, executionRepository } =
      makeSut();

    const { results } = await sut.execute(
      submission(extruder.id, [
        ticked(dimensional, 'قطر در حد مجاز'),
        ticked(visual),
      ]),
    );

    expect(executionRepository.savedEvents).toEqual([
      new QcExecutionRecorded(
        results[0].executionId,
        extruder.id.asString(),
        'اکسترودر 1',
        dimensional.id.asString(),
        'بازرسی ابعادی',
        NOW,
        'نیکروش',
        'TR-100',
        'قطر در حد مجاز',
      ),
      new QcExecutionRecorded(
        results[1].executionId,
        extruder.id.asString(),
        'اکسترودر 1',
        visual.id.asString(),
        'بازرسی ظاهری',
        NOW,
        'نیکروش',
        'TR-100',
        null,
      ),
    ]);
  });

  it('reports each activity recorded, in the order submitted', async () => {
    const { sut, extruder, dimensional, visual, executionRepository } =
      makeSut();

    const { results } = await sut.execute(
      submission(extruder.id, [ticked(visual), ticked(dimensional)]),
    );

    const [visualRecord, dimensionalRecord] = executionRepository.all();
    expect(results).toEqual([
      QcActivityRecordingResult.recorded(visual, visualRecord.id),
      QcActivityRecordingResult.recorded(dimensional, dimensionalRecord.id),
    ]);
  });

  it('records every activity of one submission at the same instant', async () => {
    const { sut, extruder, dimensional, visual, executionRepository } = makeSut(
      { clock: new TickingClock(NOW) },
    );

    await sut.execute(
      submission(extruder.id, [ticked(dimensional), ticked(visual)]),
    );

    expect(
      executionRepository.all().map((record) => record.performedAt()),
    ).toEqual([NOW, NOW]);
  });

  it('gives an activity not ticked no record', async () => {
    const { sut, extruder, dimensional, thickness, executionRepository } =
      makeSut();

    await sut.execute(submission(extruder.id, [ticked(dimensional)]));

    expect(
      executionRepository
        .all()
        .filter((record) => record.activityId().equals(thickness.id)),
    ).toEqual([]);
  });

  it('refuses an activity no longer assigned, recording the others', async () => {
    const { sut, extruder, dimensional, visual, executionRepository } =
      makeSut();
    extruder.unassignQcActivity(visual);

    const { results } = await sut.execute(
      submission(extruder.id, [ticked(dimensional), ticked(visual)]),
    );

    const [dimensionalRecord] = executionRepository.all();
    expect(results).toEqual([
      QcActivityRecordingResult.recorded(dimensional, dimensionalRecord.id),
      QcActivityRecordingResult.notAssigned(visual),
    ]);
    expect(executionRepository.all()).toHaveLength(1);
  });

  it('refuses an unknown activity, unnamed, recording the others', async () => {
    const { sut, extruder, dimensional, executionRepository } = makeSut();
    const unknown = Identity.new();

    const { results } = await sut.execute(
      submission(extruder.id, [
        { activityId: unknown, notes: undefined },
        ticked(dimensional),
      ]),
    );

    const [dimensionalRecord] = executionRepository.all();
    expect(results).toEqual([
      QcActivityRecordingResult.activityNotFound(unknown),
      QcActivityRecordingResult.recorded(dimensional, dimensionalRecord.id),
    ]);
  });

  it('refuses retired equipment as a whole, recording nothing', async () => {
    const { world, sut, extruder, dimensional, executionRepository } =
      makeSut();
    extruder.retire(world.clock.now());

    await expect(
      sut.execute(
        submission(extruder.id, [
          { activityId: Identity.new(), notes: undefined },
          ticked(dimensional),
        ]),
      ),
    ).rejects.toBeInstanceOf(EquipmentIsRetired);
    expect(executionRepository.all()).toEqual([]);
  });

  it('refuses unknown equipment', async () => {
    const { sut, dimensional } = makeSut();

    await expect(
      sut.execute(submission(Identity.new(), [ticked(dimensional)])),
    ).rejects.toBeInstanceOf(EquipmentNotFound);
  });

  describe('sent again (the same submission)', () => {
    it('reports the records already made, making none', async () => {
      const { sut, extruder, dimensional, visual, executionRepository } =
        makeSut();
      const sending = sameSubmissionEachTime(
        sut,
        submission(extruder.id, [ticked(dimensional), ticked(visual)]),
      );
      const first = await sending();
      executionRepository.savedEvents.length = 0;

      const again = await sending();

      expect(again).toEqual(first);
      expect(executionRepository.all()).toHaveLength(2);
      expect(executionRepository.savedEvents).toEqual([]);
    });

    it('records only what the first sending refused', async () => {
      const { sut, extruder, dimensional, visual, executionRepository } =
        makeSut();
      const sending = sameSubmissionEachTime(
        sut,
        submission(extruder.id, [ticked(dimensional), ticked(visual)]),
      );
      extruder.unassignQcActivity(visual);
      await sending();
      extruder.assignQcActivity(visual);

      const { results } = await sending();

      const [dimensionalRecord, visualRecord] = executionRepository.all();
      expect(executionRepository.all()).toHaveLength(2);
      expect(results).toEqual([
        QcActivityRecordingResult.recorded(dimensional, dimensionalRecord.id),
        QcActivityRecordingResult.recorded(visual, visualRecord.id),
      ]);
    });

    it('answers what it recorded even once the equipment is retired', async () => {
      const { world, sut, extruder, dimensional, visual } = makeSut();
      const sending = sameSubmissionEachTime(
        sut,
        submission(extruder.id, [ticked(dimensional), ticked(visual)]),
      );
      const first = await sending();
      extruder.retire(world.clock.now());

      const again = await sending();

      expect(again).toEqual(first);
    });

    it('refuses retired equipment for an activity it has not recorded yet', async () => {
      const { world, sut, extruder, dimensional, visual, executionRepository } =
        makeSut();
      const submissionId = Identity.new();
      await sut.execute(
        submission(extruder.id, [ticked(dimensional)], submissionId),
      );
      extruder.retire(world.clock.now());

      await expect(
        sut.execute(
          submission(
            extruder.id,
            [ticked(dimensional), ticked(visual)],
            submissionId,
          ),
        ),
      ).rejects.toBeInstanceOf(EquipmentIsRetired);
      expect(executionRepository.all()).toHaveLength(1);
    });

    it.each([
      [
        'another tracking number',
        (command: RecordQcExecutionsCommand) =>
          new RecordQcExecutionsCommand(
            command.equipmentId,
            command.performedById,
            command.submissionId,
            QcTrackingNumber.fromString('TR-200'),
            command.activities,
          ),
      ],
      [
        'another inspector',
        (command: RecordQcExecutionsCommand) =>
          new RecordQcExecutionsCommand(
            command.equipmentId,
            anotherInspectorId,
            command.submissionId,
            command.trackingNumber,
            command.activities,
          ),
      ],
    ])(
      'refuses it whole when sent with %s, recording nothing',
      async (_label, changed) => {
        const { sut, extruder, dimensional, visual, executionRepository } =
          makeSut();
        const first = submission(extruder.id, [ticked(dimensional)]);
        await sut.execute(first);

        const refusal = sut.execute(
          changed(
            new RecordQcExecutionsCommand(
              first.equipmentId,
              first.performedById,
              first.submissionId,
              first.trackingNumber,
              [ticked(dimensional), ticked(visual)],
            ),
          ),
        );

        await expect(refusal).rejects.toBeInstanceOf(QcSubmissionMismatch);
        expect(executionRepository.all()).toHaveLength(1);
      },
    );

    it('refuses it whole when sent for another equipment, recording nothing', async () => {
      const { world, sut, extruder, dimensional, executionRepository } =
        makeSut();
      const press = world.equipment('پرس 2');
      world.qcAssigned(press, dimensional);
      const submissionId = Identity.new();
      await sut.execute(
        submission(extruder.id, [ticked(dimensional)], submissionId),
      );

      await expect(
        sut.execute(submission(press.id, [ticked(dimensional)], submissionId)),
      ).rejects.toBeInstanceOf(QcSubmissionMismatch);
      expect(executionRepository.all()).toHaveLength(1);
    });

    it('reports the record of a sending saved at the same time, making none', async () => {
      const submissionId = Identity.new();
      const raced = new RacedQcExecutionRepository();
      const { sut, extruder, dimensional } = makeSut({
        executionRepository: raced,
      });
      const theOtherSendingsRecord = extruder.recordQcExecutionOf(
        dimensional,
        NOW,
        { id: inspectorId, name: 'نیکروش' },
        { trackingNumber: TR_100, notes: null, submissionId },
      );
      raced.racedBy(() => theOtherSendingsRecord);

      const { results } = await sut.execute(
        submission(extruder.id, [ticked(dimensional)], submissionId),
      );

      expect(results).toEqual([
        QcActivityRecordingResult.recorded(
          dimensional,
          theOtherSendingsRecord.id,
        ),
      ]);
      expect(raced.all()).toHaveLength(1);
      expect(raced.savedEvents).toEqual([]);
    });
  });

  it('records the same activities again in a new submission', async () => {
    const { world, sut, extruder, dimensional, visual, executionRepository } =
      makeSut();
    await sut.execute(
      submission(extruder.id, [ticked(dimensional), ticked(visual)]),
    );
    world.clock.set(LATER);

    await sut.execute(
      submission(extruder.id, [ticked(dimensional), ticked(visual)]),
    );

    expect(
      executionRepository.all().map((record) => record.performedAt()),
    ).toEqual([NOW, NOW, LATER, LATER]);
  });
});
