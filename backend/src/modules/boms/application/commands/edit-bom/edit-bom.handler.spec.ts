import {
  BomMustHaveAtLeastOneComponent,
  BomOrderNotDefined,
} from '@boms/application/exceptions';
import { BomCompositionFactory } from '@boms/application/service/bom-composition.factory';
import { InMemoryBomRepository } from '@boms/application/support/in-memory-bom-repository';
import { InMemoryOrderRepository } from '@boms/application/support/in-memory-order-repository';
import { StubQueryBus } from '@boms/application/support/stub-query-bus';
import { stubStandardBoms } from '@boms/application/support/stub-standard-boms';
import { Bom } from '@boms/domain/bom.aggregate';
import { BomMiCodeNotInOrder } from '@boms/domain/exceptions/bom-mi-code-not-in-order.exception';
import { EditReasonRequired } from '@boms/domain/exceptions/edit-reason-required.exception';
import { Order } from '@boms/domain/order.aggregate';
import { ApprovalStatus } from '@boms/domain/value/approval-status';
import { BomComponentLine } from '@boms/domain/value/bom-component-line.vo';
import { BomEditRecord } from '@boms/domain/value/bom-edit-record.vo';
import { BomEditSource } from '@boms/domain/value/bom-edit-source';
import { BomMaterialLine } from '@boms/domain/value/bom-material-line.vo';
import { OrderMiCode } from '@boms/domain/value/order-mi-code.vo';
import { OrderNumber } from '@boms/domain/value/order-number.vo';
import { TrackingNumber } from '@boms/domain/value/tracking-number.vo';
import { Weight } from '@boms/domain/value/weight.vo';
import {
  RecordDependencies,
  RecordHasDependents,
} from '@framework/application';
import { StubDependentsProbe } from '@framework/application/support/stub-dependents-probe';
import { Clock, EntityNotFound, Identity, Role } from '@framework/domain';
import { QueryBus } from '@nestjs/cqrs';

import { EditBomCommand } from './edit-bom.command';
import { EditBomHandler } from './edit-bom.handler';

// 1403/06/15 10:00 in Tehran (UTC+03:30).
const NOW = new Date('2024-09-05T06:30:00.000Z');
const EDITOR_NAME = 'نیکروش';
const REASON = 'خطای ترازو';

class FixedClock extends Clock {
  now(): Date {
    return NOW;
  }
}

const COMPOSITION = [
  {
    id: 'component-1',
    name: 'Bolt',
    materials: [{ id: 'material-1', name: 'Steel Rod', weight: 150 }],
  },
  {
    id: 'component-2',
    name: 'Nut',
    materials: [{ id: 'material-2', name: 'Copper Wire', weight: 100 }],
  },
];

// 1234, 1235 and 1236 are standard BOMs of «Product 1», 2001 of another.
function standardBom(miCode: string, productId = 'product-1') {
  return {
    id: `standard-bom-${miCode}`,
    miCode,
    productId,
    productName: productId === 'product-1' ? 'Product 1' : 'Product 2',
    brand: miCode === '1234' ? 'Legrand' : 'Nexans',
    standardLength: miCode === '1234' ? 305 : 500,
    components: COMPOSITION,
  };
}

function assigned(miCode: string, productId = 'product-1'): OrderMiCode {
  return OrderMiCode.of(
    Identity.fromString(`standard-bom-${miCode}`),
    miCode,
    Identity.fromString(productId),
    productId === 'product-1' ? 'Product 1' : 'Product 2',
  );
}

function makeSut() {
  const queryBus = new StubQueryBus();
  stubStandardBoms(queryBus, [
    standardBom('1234'),
    standardBom('1235'),
    standardBom('1236'),
    standardBom('2001', 'product-2'),
  ]);
  const bomRepository = new InMemoryBomRepository();
  const orderRepository = new InMemoryOrderRepository();
  // The seeded daily BOM's order assigns 1234, 1235 (same product) and 2001
  // (another product), not 1236. SO-9999 holds 1234; SO-5005 only 1235;
  // SO-5006 1234 and 1235.
  for (const [orderNumber, miCodes] of [
    [
      'SO-1234',
      [assigned('1234'), assigned('1235'), assigned('2001', 'product-2')],
    ],
    ['SO-9999', [assigned('1234')]],
    ['SO-5005', [assigned('1235')]],
    ['SO-5006', [assigned('1234'), assigned('1235')]],
  ] as const) {
    orderRepository.seed(
      Order.define(OrderNumber.fromString(orderNumber), [...miCodes]),
    );
  }
  const compositionFactory = new BomCompositionFactory(
    queryBus as unknown as QueryBus,
  );
  const probe = new StubDependentsProbe();
  const sut = new EditBomHandler(
    bomRepository,
    orderRepository,
    compositionFactory,
    new FixedClock(),
    new RecordDependencies([probe]),
  );
  return { sut, bomRepository, probe };
}

function seedBom(bomRepository: InMemoryBomRepository): Bom {
  return bomRepository.seed(
    Bom.register(
      Identity.fromString('standard-bom-1234'),
      '1234',
      'Legrand',
      'Product 1',
      305,
      OrderNumber.fromString('SO-1234'),
      TrackingNumber.fromString('TN-5678'),
      'Original description',
      'Sina',
      [
        BomComponentLine.of(Identity.fromString('component-1'), 'Bolt', [
          BomMaterialLine.of(
            Identity.fromString('material-1'),
            'Steel Rod',
            Weight.ofGrams(150),
          ),
        ]),
      ],
    ),
  );
}

const SAME_WEIGHTS = [
  {
    componentId: 'component-1',
    materials: [{ materialId: 'material-1', weight: 150 }],
  },
];

function changeOf(
  bom: Bom,
  {
    orderNumber,
    miCode,
    withoutComposition = false,
  }: {
    orderNumber?: string;
    miCode?: string;
    withoutComposition?: boolean;
  },
): EditBomCommand {
  return new EditBomCommand(
    bom.id,
    Role.QcInspector,
    EDITOR_NAME,
    BomEditSource.DailyBoms,
    'اشتباه در انتخاب MI',
    orderNumber === undefined ? undefined : OrderNumber.fromString(orderNumber),
    undefined,
    undefined,
    miCode === undefined || withoutComposition ? undefined : SAME_WEIGHTS,
    miCode,
  );
}

describe('EditBomHandler', () => {
  it('refuses editing a daily BOM that was re-sampled, leaving it unchanged', async () => {
    const { sut, bomRepository, probe } = makeSut();
    const bom = seedBom(bomRepository);
    probe.given({ type: 'Bom', id: bom.id.asString() }, [
      { kind: 'resampled-daily-bom', name: 'SO-1234' },
    ]);

    await expect(
      sut.execute(
        new EditBomCommand(
          bom.id,
          Role.QcInspector,
          EDITOR_NAME,
          BomEditSource.DailyBoms,
          REASON,
          OrderNumber.fromString('SO-9999'),
        ),
      ),
    ).rejects.toBeInstanceOf(RecordHasDependents);
    const kept = await bomRepository.get(bom.id);
    expect(kept.orderNumber().asString()).toBe('SO-1234');
    expect(kept.editHistory()).toEqual([]);
  });

  it('edits a BOM’s scalar fields, leaving its components untouched', async () => {
    const { sut, bomRepository } = makeSut();
    const bom = seedBom(bomRepository);
    const originalComponents = bom.components();

    await sut.execute(
      new EditBomCommand(
        bom.id,
        Role.QcInspector,
        EDITOR_NAME,
        BomEditSource.DailyBoms,
        REASON,

        OrderNumber.fromString('SO-9999'),
        TrackingNumber.fromString('TN-0000'),
        'Updated description',
      ),
    );

    const saved = await bomRepository.get(bom.id);
    expect(saved.orderNumber().asString()).toBe('SO-9999');
    expect(saved.trackingNumber().asString()).toBe('TN-0000');
    expect(saved.description()).toBe('Updated description');
    expect(saved.components()).toEqual(originalComponents);
    expect(saved.standardBomMiCode()).toBe('1234');
    expect(saved.brand()).toBe('Legrand');
    expect(saved.productName()).toBe('Product 1');
    expect(saved.standardLength()).toBe(305);
    expect(saved.registeredBy()).toBe('Sina');
  });

  it('replaces a BOM’s composition wholesale, leaving its scalar fields untouched', async () => {
    const { sut, bomRepository } = makeSut();
    const bom = seedBom(bomRepository);

    await sut.execute(
      new EditBomCommand(
        bom.id,
        Role.QcInspector,
        EDITOR_NAME,
        BomEditSource.DailyBoms,
        REASON,

        undefined,
        undefined,
        undefined,
        [
          {
            componentId: 'component-2',
            materials: [{ materialId: 'material-2', weight: 200 }],
          },
        ],
        '1234',
      ),
    );

    const saved = await bomRepository.get(bom.id);
    expect(saved.orderNumber().asString()).toBe('SO-1234');
    expect(saved.components()).toHaveLength(1);
    expect(saved.components()[0].componentId().asString()).toBe('component-2');
    expect(saved.components()[0].name()).toBe('Nut');
    expect(saved.components()[0].materials()[0].weight().asGrams()).toBe(200);
  });

  it('rejects editing a BOM to have no components', async () => {
    const { sut, bomRepository } = makeSut();
    const bom = seedBom(bomRepository);

    await expect(
      sut.execute(
        new EditBomCommand(
          bom.id,
          Role.QcInspector,
          EDITOR_NAME,
          BomEditSource.DailyBoms,
          REASON,

          undefined,
          undefined,
          undefined,
          [],
          '1234',
        ),
      ),
    ).rejects.toBeInstanceOf(BomMustHaveAtLeastOneComponent);
  });

  it('rejects editing a BOM that does not exist', async () => {
    const { sut } = makeSut();

    await expect(
      sut.execute(
        new EditBomCommand(
          Identity.new(),
          Role.QcInspector,
          EDITOR_NAME,
          BomEditSource.DailyBoms,
          REASON,
        ),
      ),
    ).rejects.toBeInstanceOf(EntityNotFound);
  });

  it("rejects a componentId that isn't part of the referenced standard BOM's current composition", async () => {
    const { sut, bomRepository } = makeSut();
    const bom = seedBom(bomRepository);

    await expect(
      sut.execute(
        new EditBomCommand(
          bom.id,
          Role.QcInspector,
          EDITOR_NAME,
          BomEditSource.DailyBoms,
          REASON,

          undefined,
          undefined,
          undefined,
          [
            {
              componentId: 'unknown-component',
              materials: [{ materialId: 'material-1', weight: 150 }],
            },
          ],
          '1234',
        ),
      ),
    ).rejects.toThrow();
  });

  it('rejects replacing a BOM’s composition without a standardBomMiCode to reclone from', async () => {
    const { sut, bomRepository } = makeSut();
    const bom = seedBom(bomRepository);

    await expect(
      sut.execute(
        new EditBomCommand(
          bom.id,
          Role.QcInspector,
          EDITOR_NAME,
          BomEditSource.DailyBoms,
          REASON,

          undefined,
          undefined,
          undefined,
          [
            {
              componentId: 'component-2',
              materials: [{ materialId: 'material-2', weight: 200 }],
            },
          ],
        ),
      ),
    ).rejects.toThrow(
      'standardBomMiCode is required when components is provided',
    );
  });

  it('an edit that changes an approved BOM sends it back to pending', async () => {
    const { sut, bomRepository } = makeSut();
    const bom = seedBom(bomRepository);
    bom.approve('مصطفی');

    await sut.execute(
      new EditBomCommand(
        bom.id,
        Role.QcInspector,
        EDITOR_NAME,
        BomEditSource.DailyBoms,
        REASON,

        undefined,
        TrackingNumber.fromString('TN-0000'),
      ),
    );

    const saved = await bomRepository.get(bom.id);
    expect(saved.approvalStatus()).toBe(ApprovalStatus.Pending);
    expect(saved.reviewedBy()).toBeNull();
  });

  it('a rejected edit leaves an approved BOM approved by the same reviewer', async () => {
    const { sut, bomRepository } = makeSut();
    const bom = seedBom(bomRepository);
    bom.approve('مصطفی');

    await expect(
      sut.execute(
        new EditBomCommand(
          bom.id,
          Role.QcInspector,
          EDITOR_NAME,
          BomEditSource.DailyBoms,
          REASON,

          OrderNumber.fromString('SO-9999'),
          undefined,
          undefined,
          [],
          '1234',
        ),
      ),
    ).rejects.toBeInstanceOf(BomMustHaveAtLeastOneComponent);
    const saved = await bomRepository.get(bom.id);
    expect(saved.approvalStatus()).toBe(ApprovalStatus.Approved);
    expect(saved.reviewedBy()).toBe('مصطفی');
  });

  it('records a correction as made by the editor, at the clock’s time, for the given reason', async () => {
    const { sut, bomRepository } = makeSut();
    const bom = seedBom(bomRepository);

    await sut.execute(
      new EditBomCommand(
        bom.id,
        Role.QcInspector,
        EDITOR_NAME,
        BomEditSource.DailyBoms,
        REASON,
        undefined,
        TrackingNumber.fromString('TN-0000'),
      ),
    );

    const saved = await bomRepository.get(bom.id);
    expect(saved.editHistory()).toEqual([
      BomEditRecord.of(EDITOR_NAME, NOW, REASON, [
        'شماره ردیابی از TN-5678 به TN-0000 تغییر کرد',
      ]),
    ]);
  });

  it('refuses an edit that changes something without a reason, leaving the BOM as it was', async () => {
    const { sut, bomRepository } = makeSut();
    const bom = seedBom(bomRepository);

    await expect(
      sut.execute(
        new EditBomCommand(
          bom.id,
          Role.QcInspector,
          EDITOR_NAME,
          BomEditSource.DailyBoms,
          undefined,
          undefined,
          TrackingNumber.fromString('TN-0000'),
        ),
      ),
    ).rejects.toBeInstanceOf(EditReasonRequired);
    const saved = await bomRepository.get(bom.id);
    expect(saved.trackingNumber().asString()).toBe('TN-5678');
  });

  it.each([[Role.Management], [Role.SystemAdmin]])(
    'an edit from the dashboard by a user with the %p role, who may review, is noted when the BOM is approved',
    async (role) => {
      const { sut, bomRepository } = makeSut();
      const bom = seedBom(bomRepository);
      await sut.execute(
        new EditBomCommand(
          bom.id,
          role,
          'مصطفی',
          BomEditSource.Dashboard,
          REASON,
          undefined,
          TrackingNumber.fromString('TN-0000'),
        ),
      );
      const saved = await bomRepository.get(bom.id);

      saved.approve('مصطفی');

      expect(saved.managementNote()).toBe(
        [
          'کاربر مصطفی در 1403/06/15 ساعت 10:00 به علت خطای ترازو تغییرات زیر را انجام داد',
          'شماره ردیابی از TN-5678 به TN-0000 تغییر کرد',
        ].join('\n'),
      );
    },
  );

  it.each([
    [
      'a reviewer from the daily BOMs page',
      Role.Management,
      BomEditSource.DailyBoms,
    ],
    [
      'an inspector from the dashboard',
      Role.QcInspector,
      BomEditSource.Dashboard,
    ],
    ['an unknown user from the dashboard', null, BomEditSource.Dashboard],
  ])(
    'an edit by %s is not noted when the BOM is approved, but kept as an edit detail',
    async (_editor, role, source) => {
      const { sut, bomRepository } = makeSut();
      const bom = seedBom(bomRepository);
      await sut.execute(
        new EditBomCommand(
          bom.id,
          role,
          EDITOR_NAME,
          source,
          REASON,
          undefined,
          TrackingNumber.fromString('TN-0000'),
        ),
      );
      const saved = await bomRepository.get(bom.id);

      saved.approve('مصطفی');

      expect([saved.managementNote(), saved.editHistory()]).toEqual([
        null,
        [
          BomEditRecord.of(EDITOR_NAME, NOW, REASON, [
            'شماره ردیابی از TN-5678 به TN-0000 تغییر کرد',
          ]),
        ],
      ]);
    },
  );

  describe('changing its MI code (issue #101)', () => {
    it('re-points it at another MI code of the same product on its order, sending an approved one back to pending', async () => {
      const { sut, bomRepository } = makeSut();
      const bom = seedBom(bomRepository);
      bom.approve('مصطفی');

      await sut.execute(changeOf(bom, { miCode: '۱۲۳۵' }));

      const saved = await bomRepository.get(bom.id);
      expect(saved.standardBomMiCode()).toBe('1235');
      expect(saved.standardBomId().asString()).toBe('standard-bom-1235');
      expect(saved.brand()).toBe('Nexans');
      expect(saved.standardLength()).toBe(500);
      expect(saved.approvalStatus()).toBe(ApprovalStatus.Pending);
      expect(saved.editHistory()[0].changes()).toEqual([
        'کد MI از 1234 به 1235 تغییر کرد',
      ]);
    });

    it.each([
      ['of another product, though on the order', '2001'],
      ['not on the order, though of the same product', '1236'],
    ])('refuses an MI code %s, leaving it as it was', async (_why, miCode) => {
      const { sut, bomRepository } = makeSut();
      const bom = seedBom(bomRepository);

      await expect(
        sut.execute(changeOf(bom, { miCode })),
      ).rejects.toBeInstanceOf(BomMiCodeNotInOrder);
      const kept = await bomRepository.get(bom.id);
      expect(kept.standardBomMiCode()).toBe('1234');
      expect(kept.editHistory()).toEqual([]);
    });

    it('refuses another MI code without the composition to clone from it', async () => {
      const { sut, bomRepository } = makeSut();
      const bom = seedBom(bomRepository);

      await expect(
        sut.execute(
          changeOf(bom, { miCode: '1235', withoutComposition: true }),
        ),
      ).rejects.toBeInstanceOf(BomMustHaveAtLeastOneComponent);
    });
  });

  describe('changing its order number (issue #101)', () => {
    it('moves it to a defined order holding its MI code', async () => {
      const { sut, bomRepository } = makeSut();
      const bom = seedBom(bomRepository);

      await sut.execute(changeOf(bom, { orderNumber: 'SO-9999' }));

      const saved = await bomRepository.get(bom.id);
      expect(saved.orderNumber().asString()).toBe('SO-9999');
    });

    it('refuses an order number no order has', async () => {
      const { sut, bomRepository } = makeSut();
      const bom = seedBom(bomRepository);

      await expect(
        sut.execute(changeOf(bom, { orderNumber: 'ORD-6001' })),
      ).rejects.toBeInstanceOf(BomOrderNotDefined);
      const kept = await bomRepository.get(bom.id);
      expect(kept.orderNumber().asString()).toBe('SO-1234');
    });

    it('refuses an order without its MI code', async () => {
      const { sut, bomRepository } = makeSut();
      const bom = seedBom(bomRepository);

      await expect(
        sut.execute(changeOf(bom, { orderNumber: 'SO-5005' })),
      ).rejects.toBeInstanceOf(BomMiCodeNotInOrder);
    });

    it('moves it to an order holding both its MI code and the one it changes to in the same edit', async () => {
      const { sut, bomRepository } = makeSut();
      const bom = seedBom(bomRepository);

      await sut.execute(
        changeOf(bom, { orderNumber: 'SO-5006', miCode: '1235' }),
      );

      const saved = await bomRepository.get(bom.id);
      expect(saved.orderNumber().asString()).toBe('SO-5006');
      expect(saved.standardBomMiCode()).toBe('1235');
    });

    // The new order tells whether the two MI codes are of one product, from
    // its own snapshots — so it must hold the one the daily BOM leaves too.
    it('refuses moving it, with a new MI code, to an order without the MI code it had', async () => {
      const { sut, bomRepository } = makeSut();
      const bom = seedBom(bomRepository);

      await expect(
        sut.execute(changeOf(bom, { orderNumber: 'SO-5005', miCode: '1235' })),
      ).rejects.toBeInstanceOf(BomMiCodeNotInOrder);
    });
  });
});
