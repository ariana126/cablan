import { InMemoryBomRepository } from '@boms/application/support/in-memory-bom-repository';
import { Bom } from '@boms/domain/bom.aggregate';
import { ApprovalStatus } from '@boms/domain/value/approval-status';
import { BomApproval } from '@boms/domain/value/bom-approval.vo';
import { BomComponentLine } from '@boms/domain/value/bom-component-line.vo';
import { BomMaterialLine } from '@boms/domain/value/bom-material-line.vo';
import { OrderNumber } from '@boms/domain/value/order-number.vo';
import { TrackingNumber } from '@boms/domain/value/tracking-number.vo';
import { Weight } from '@boms/domain/value/weight.vo';
import { EntityNotFound, Identity } from '@framework/domain';

import { RevokeBomApprovalCommand } from './revoke-bom-approval.command';
import { RevokeBomApprovalHandler } from './revoke-bom-approval.handler';

function seedBom(
  bomRepository: InMemoryBomRepository,
  approval: BomApproval,
): Bom {
  return bomRepository.seed(
    Bom.fromPersistence(
      Identity.new(),
      Identity.new(),
      '1234',
      'Legrand',
      'Product 1',
      305,
      OrderNumber.fromString('ORD-5002'),
      TrackingNumber.fromString('TRK-5002'),
      undefined,
      'نیکروش',
      [
        BomComponentLine.of(Identity.new(), 'Bolt', [
          BomMaterialLine.of(Identity.new(), 'Steel Rod', Weight.ofGrams(150)),
        ]),
      ],
      approval,
    ),
  );
}

describe('RevokeBomApprovalHandler', () => {
  it('sends an approved daily BOM back to unapproved, with no approver', async () => {
    const bomRepository = new InMemoryBomRepository();
    const bom = seedBom(bomRepository, BomApproval.by('مصطفی'));
    const sut = new RevokeBomApprovalHandler(bomRepository);

    await sut.execute(new RevokeBomApprovalCommand(bom.id));

    const saved = await bomRepository.get(bom.id);
    expect(saved.approvalStatus()).toBe(ApprovalStatus.Unapproved);
    expect(saved.approvedBy()).toBeNull();
  });

  it('revoking an unapproved daily BOM leaves it unapproved', async () => {
    const bomRepository = new InMemoryBomRepository();
    const bom = seedBom(bomRepository, BomApproval.unapproved());
    const sut = new RevokeBomApprovalHandler(bomRepository);

    await sut.execute(new RevokeBomApprovalCommand(bom.id));

    const saved = await bomRepository.get(bom.id);
    expect(saved.approvalStatus()).toBe(ApprovalStatus.Unapproved);
  });

  it('rejects revoking the approval of a daily BOM that does not exist', async () => {
    const sut = new RevokeBomApprovalHandler(new InMemoryBomRepository());

    await expect(
      sut.execute(new RevokeBomApprovalCommand(Identity.new())),
    ).rejects.toBeInstanceOf(EntityNotFound);
  });

  it('revoking an unapproved daily BOM saves nothing, so it cannot overwrite a concurrent change', async () => {
    const bomRepository = new InMemoryBomRepository();
    const bom = seedBom(bomRepository, BomApproval.unapproved());
    const sut = new RevokeBomApprovalHandler(bomRepository);

    await sut.execute(new RevokeBomApprovalCommand(bom.id));

    expect(bomRepository.timesSaved(bom.id)).toBe(0);
  });
});
