import { InMemoryBomRepository } from '@boms/application/support/in-memory-bom-repository';
import { Bom } from '@boms/domain/bom.aggregate';
import { BomAlreadyReviewed } from '@boms/domain/exceptions/bom-already-reviewed.exception';
import { RejectionReasonRequired } from '@boms/domain/exceptions/rejection-reason-required.exception';
import { ApprovalStatus } from '@boms/domain/value/approval-status';
import { BomComponentLine } from '@boms/domain/value/bom-component-line.vo';
import { BomMaterialLine } from '@boms/domain/value/bom-material-line.vo';
import { OrderNumber } from '@boms/domain/value/order-number.vo';
import { TrackingNumber } from '@boms/domain/value/tracking-number.vo';
import { Weight } from '@boms/domain/value/weight.vo';
import { EntityNotFound, Identity } from '@framework/domain';

import { RejectBomCommand } from './reject-bom.command';
import { RejectBomHandler } from './reject-bom.handler';

function seedBom(bomRepository: InMemoryBomRepository): Bom {
  return bomRepository.seed(
    Bom.register(
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
    ),
  );
}

describe('RejectBomHandler', () => {
  it('rejects a pending daily BOM as the reviewer, with the reason as its management note', async () => {
    const bomRepository = new InMemoryBomRepository();
    const bom = seedBom(bomRepository);
    const sut = new RejectBomHandler(bomRepository);

    await sut.execute(
      new RejectBomCommand(bom.id, 'مصطفی', 'وزن مس خارج از محدوده است'),
    );

    const saved = await bomRepository.get(bom.id);
    expect(saved.approvalStatus()).toBe(ApprovalStatus.Rejected);
    expect(saved.reviewedBy()).toBe('مصطفی');
    expect(saved.managementNote()).toBe('وزن مس خارج از محدوده است');
  });

  it.each([[undefined], [''], ['  ']])(
    'refuses a rejection with the reason %p, saving nothing',
    async (reason) => {
      const bomRepository = new InMemoryBomRepository();
      const bom = seedBom(bomRepository);
      const sut = new RejectBomHandler(bomRepository);

      await expect(
        sut.execute(new RejectBomCommand(bom.id, 'مصطفی', reason)),
      ).rejects.toBeInstanceOf(RejectionReasonRequired);
      expect(bomRepository.timesSaved(bom.id)).toBe(0);
    },
  );

  it('refuses to reject an approved daily BOM, saving nothing', async () => {
    const bomRepository = new InMemoryBomRepository();
    const bom = seedBom(bomRepository);
    bom.approve('مصطفی');
    const sut = new RejectBomHandler(bomRepository);

    await expect(
      sut.execute(new RejectBomCommand(bom.id, 'مصطفی', 'دلیل')),
    ).rejects.toBeInstanceOf(BomAlreadyReviewed);
    expect(bomRepository.timesSaved(bom.id)).toBe(0);
  });

  it('rejects rejecting a daily BOM that does not exist', async () => {
    const sut = new RejectBomHandler(new InMemoryBomRepository());

    await expect(
      sut.execute(new RejectBomCommand(Identity.new(), 'مصطفی', 'دلیل')),
    ).rejects.toBeInstanceOf(EntityNotFound);
  });
});
