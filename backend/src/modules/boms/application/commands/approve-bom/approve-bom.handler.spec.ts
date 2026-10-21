import { InMemoryBomRepository } from '@boms/application/support/in-memory-bom-repository';
import { Bom } from '@boms/domain/bom.aggregate';
import { ApprovalStatus } from '@boms/domain/value/approval-status';
import { BomComponentLine } from '@boms/domain/value/bom-component-line.vo';
import { BomMaterialLine } from '@boms/domain/value/bom-material-line.vo';
import { OrderNumber } from '@boms/domain/value/order-number.vo';
import { TrackingNumber } from '@boms/domain/value/tracking-number.vo';
import { Weight } from '@boms/domain/value/weight.vo';
import { EntityNotFound, Identity } from '@framework/domain';

import { ApproveBomCommand } from './approve-bom.command';
import { ApproveBomHandler } from './approve-bom.handler';

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

describe('ApproveBomHandler', () => {
  it('approves a daily BOM as the approver', async () => {
    const bomRepository = new InMemoryBomRepository();
    const bom = seedBom(bomRepository);
    const sut = new ApproveBomHandler(bomRepository);

    await sut.execute(new ApproveBomCommand(bom.id, 'مصطفی'));

    const saved = await bomRepository.get(bom.id);
    expect(saved.approvalStatus()).toBe(ApprovalStatus.Approved);
    expect(saved.approvedBy()).toBe('مصطفی');
  });

  it('approving an already approved daily BOM keeps its original approver', async () => {
    const bomRepository = new InMemoryBomRepository();
    const bom = seedBom(bomRepository);
    const sut = new ApproveBomHandler(bomRepository);
    await sut.execute(new ApproveBomCommand(bom.id, 'مصطفی'));

    await sut.execute(new ApproveBomCommand(bom.id, 'یاشار'));

    const saved = await bomRepository.get(bom.id);
    expect(saved.approvedBy()).toBe('مصطفی');
  });

  it('rejects approving a daily BOM that does not exist', async () => {
    const sut = new ApproveBomHandler(new InMemoryBomRepository());

    await expect(
      sut.execute(new ApproveBomCommand(Identity.new(), 'مصطفی')),
    ).rejects.toBeInstanceOf(EntityNotFound);
  });

  it('approving an already approved daily BOM saves nothing, so it cannot overwrite a concurrent change', async () => {
    const bomRepository = new InMemoryBomRepository();
    const bom = seedBom(bomRepository);
    bom.approve('مصطفی');
    const sut = new ApproveBomHandler(bomRepository);

    await sut.execute(new ApproveBomCommand(bom.id, 'یاشار'));

    expect(bomRepository.timesSaved(bom.id)).toBe(0);
  });
});
