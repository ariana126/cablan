import { Identity, Role } from '@framework/domain';

import { Bom } from './bom.aggregate';
import { BomApproved } from './events/bom-approved.event';
import { BomDeleted } from './events/bom-deleted.event';
import { BomEdited } from './events/bom-edited.event';
import { BomRegistered } from './events/bom-registered.event';
import { BomRejected } from './events/bom-rejected.event';
import { BomReturnedToPending } from './events/bom-returned-to-pending.event';
import { BomAlreadyReviewed } from './exceptions/bom-already-reviewed.exception';
import { BomNotResamplable } from './exceptions/bom-not-resamplable.exception';
import { EditReasonRequired } from './exceptions/edit-reason-required.exception';
import { RejectionReasonRequired } from './exceptions/rejection-reason-required.exception';
import { ApprovalStatus } from './value/approval-status';
import { BomComponentLine } from './value/bom-component-line.vo';
import { BomEditContext } from './value/bom-edit-context.vo';
import { BomEditRecord } from './value/bom-edit-record.vo';
import { BomEditSource } from './value/bom-edit-source';
import { BomEditor } from './value/bom-editor.vo';
import { BomMaterialLine } from './value/bom-material-line.vo';
import { BomReview } from './value/bom-review.vo';
import { OrderNumber } from './value/order-number.vo';
import { PendingReviewEdits } from './value/pending-review-edits.vo';
import { TrackingNumber } from './value/tracking-number.vo';
import { Weight } from './value/weight.vo';

function componentLine(
  componentId: Identity,
  name: string,
  materialId: Identity,
  materialName: string,
): BomComponentLine {
  return BomComponentLine.of(componentId, name, [
    BomMaterialLine.of(materialId, materialName, Weight.ofGrams(150)),
  ]);
}

function registerBom(standardBomId: Identity = Identity.new()): Bom {
  return Bom.register(
    standardBomId,
    '1234',
    'Legrand',
    'Product 1',
    305,
    OrderNumber.fromString('SO-1234'),
    TrackingNumber.fromString('TN-5678'),
    'Daily BOM for order 1234',
    'Sina',
    [componentLine(Identity.new(), 'Bolt', Identity.new(), 'Steel Rod')],
  );
}

// 1403/06/15 10:00 in Tehran (UTC+03:30).
const AT_TEN = new Date('2024-09-05T06:30:00.000Z');

// A review edit — a reviewer (management) editing from the dashboard — and a
// correction — a QC inspector editing from the daily BOMs page. Only review
// edits make up a review's management note; corrections are the BOM's edit
// details.
const REVIEW_EDIT = BomEditContext.of(
  'مصطفی',
  BomEditor.withRole(Role.Management),
  BomEditSource.Dashboard,
  'خطای ترازو',
  AT_TEN,
);
const CORRECTION = BomEditContext.of(
  'نیکروش',
  BomEditor.withRole(Role.QcInspector),
  BomEditSource.DailyBoms,
  'اصلاح ثبت',
  AT_TEN,
);
// The registered composition re-cloned under new names (renamed upstream).
function renamed(bom: Bom): BomComponentLine[] {
  const [bolt] = bom.components();
  const [steelRod] = bolt.materials();
  return [
    BomComponentLine.of(bolt.componentId(), 'Bolt (renamed)', [
      BomMaterialLine.of(
        steelRod.materialId(),
        'Steel Rod (renamed)',
        steelRod.weight(),
      ),
    ]),
  ];
}

function reviewEditBy(
  reviewerName: string,
  reason: string,
  editedAt: Date,
): BomEditContext {
  return BomEditContext.of(
    reviewerName,
    BomEditor.withRole(Role.Management),
    BomEditSource.Dashboard,
    reason,
    editedAt,
  );
}

const REVIEW_HEADING =
  'کاربر مصطفی در 1403/06/15 ساعت 10:00 به علت خطای ترازو تغییرات زیر را انجام داد';

// What `act` throws — `toThrow()` cannot take an exception class whose
// constructor is private, as the domain's named-constructor exceptions are.
function errorThrownBy(act: () => void): unknown {
  try {
    act();
  } catch (error) {
    return error;
  }
  return undefined;
}

function approvedBom(reviewerName = 'مصطفی'): Bom {
  const bom = registerBom();
  bom.approve(reviewerName);
  bom.releaseEvents();
  return bom;
}

function rejectedBom(
  reviewerName = 'مصطفی',
  reason = 'وزن مس خارج از محدوده است',
): Bom {
  const bom = registerBom();
  bom.reject(reviewerName, reason);
  bom.releaseEvents();
  return bom;
}

// The registered composition (Bolt: Steel Rod 150 g) with Steel Rod weighing `grams`.
function reweighed(bom: Bom, grams: number): BomComponentLine[] {
  const [component] = bom.components();
  const [material] = component.materials();
  return [
    BomComponentLine.of(component.componentId(), component.name(), [
      BomMaterialLine.of(
        material.materialId(),
        material.name(),
        Weight.ofGrams(grams),
      ),
    ]),
  ];
}

describe('Bom', () => {
  it('registering a BOM sets its fields and components', () => {
    const standardBomId = Identity.new();
    const sut = registerBom(standardBomId);

    expect(sut.standardBomId().equals(standardBomId)).toBe(true);
    expect(sut.standardBomMiCode()).toBe('1234');
    expect(sut.brand()).toBe('Legrand');
    expect(sut.productName()).toBe('Product 1');
    expect(sut.standardLength()).toBe(305);
    expect(sut.orderNumber().asString()).toBe('SO-1234');
    expect(sut.trackingNumber().asString()).toBe('TN-5678');
    expect(sut.description()).toBe('Daily BOM for order 1234');
    expect(sut.registeredBy()).toBe('Sina');
    expect(sut.components()).toHaveLength(1);
    expect(sut.components()[0].name()).toBe('Bolt');
  });

  it('registering a BOM records a BomRegistered event carrying everything it was registered with', () => {
    const standardBomId = Identity.new();
    const sut = Bom.register(
      standardBomId,
      '1234',
      'Legrand',
      'Product 1',
      305,
      OrderNumber.fromString('SO-1234'),
      TrackingNumber.fromString('TN-5678'),
      undefined,
      'Sina',
      [
        BomComponentLine.of(Identity.new(), 'Bolt', [
          BomMaterialLine.of(Identity.new(), 'Steel Rod', Weight.ofGrams(150)),
          BomMaterialLine.of(Identity.new(), 'Zinc', Weight.ofGrams(2.5)),
        ]),
      ],
    );

    expect(sut.releaseEvents()).toEqual([
      new BomRegistered(sut.id.asString(), {
        standardBomId: standardBomId.asString(),
        standardBomMiCode: '1234',
        brand: 'Legrand',
        productName: 'Product 1',
        standardLength: 305,
        orderNumber: 'SO-1234',
        trackingNumber: 'TN-5678',
        description: undefined,
        registeredBy: 'Sina',
        components: [
          {
            name: 'Bolt',
            materials: [
              { name: 'Steel Rod', weightInGrams: 150 },
              { name: 'Zinc', weightInGrams: 2.5 },
            ],
          },
        ],
      }),
    ]);
  });

  it('a description registered with Persian or Arabic-Indic digits keeps English digits and its letters', () => {
    const sut = Bom.register(
      Identity.new(),
      '1234',
      'Legrand',
      'Product 1',
      305,
      OrderNumber.fromString('SO-1234'),
      TrackingNumber.fromString('TN-5678'),
      'سفارش ۱۲٣٤',
      'Sina',
      [componentLine(Identity.new(), 'Bolt', Identity.new(), 'Steel Rod')],
    );

    expect(sut.description()).toBe('سفارش 1234');
  });

  it('a description edited with Persian or Arabic-Indic digits keeps English digits and its letters', () => {
    const sut = registerBom();

    sut.edit(
      OrderNumber.fromString('SO-1234'),
      TrackingNumber.fromString('TN-5678'),
      'سفارش ۵٦',
      undefined,
      CORRECTION,
    );

    expect(sut.description()).toBe('سفارش 56');
  });

  it('rejects registering a BOM with no components', () => {
    expect(() =>
      Bom.register(
        Identity.new(),
        '1234',
        'Legrand',
        'Product 1',
        305,
        OrderNumber.fromString('SO-1234'),
        TrackingNumber.fromString('TN-5678'),
        undefined,
        'Sina',
        [],
      ),
    ).toThrow();
  });

  it('editing a BOM changes its fields and records a BomEdited event carrying every changed field, leaving the cloned reporting fields untouched', () => {
    const sut = registerBom();
    sut.releaseEvents();

    sut.edit(
      OrderNumber.fromString('SO-9999'),
      TrackingNumber.fromString('TN-0000'),
      'Updated description',
      undefined,
      CORRECTION,
    );

    expect(sut.orderNumber().asString()).toBe('SO-9999');
    expect(sut.trackingNumber().asString()).toBe('TN-0000');
    expect(sut.description()).toBe('Updated description');
    expect(sut.standardBomMiCode()).toBe('1234');
    expect(sut.brand()).toBe('Legrand');
    expect(sut.productName()).toBe('Product 1');
    expect(sut.standardLength()).toBe(305);
    expect(sut.registeredBy()).toBe('Sina');
    expect(sut.releaseEvents()).toEqual([
      new BomEdited(
        sut.id.asString(),
        'SO-9999',
        'TN-0000',
        'Updated description',
        [
          {
            field: 'orderNumber',
            previousValue: 'SO-1234',
            newValue: 'SO-9999',
          },
          {
            field: 'trackingNumber',
            previousValue: 'TN-5678',
            newValue: 'TN-0000',
          },
          {
            field: 'description',
            previousValue: 'Daily BOM for order 1234',
            newValue: 'Updated description',
          },
        ],
      ),
    ]);
  });

  it('editing a BOM with only its tracking number changed records just that one field', () => {
    const sut = registerBom();
    sut.releaseEvents();

    sut.edit(
      sut.orderNumber(),
      TrackingNumber.fromString('TN-0000'),
      sut.description(),
      undefined,
      CORRECTION,
    );

    const [event] = sut.releaseEvents();
    expect(event).toEqual(
      new BomEdited(
        sut.id.asString(),
        'SO-1234',
        'TN-0000',
        'Daily BOM for order 1234',
        [
          {
            field: 'trackingNumber',
            previousValue: 'TN-5678',
            newValue: 'TN-0000',
          },
        ],
      ),
    );
  });

  it('editing a BOM with every field unchanged records no event', () => {
    const sut = registerBom();
    sut.releaseEvents();

    sut.edit(
      sut.orderNumber(),
      sut.trackingNumber(),
      sut.description(),
      undefined,
      CORRECTION,
    );

    expect(sut.releaseEvents()).toEqual([]);
  });

  it('editing a BOM with new components replaces the previous list and records one BomEdited event carrying the composition before and after, even when no scalar field changed', () => {
    const sut = registerBom();
    sut.releaseEvents();
    const newComponents = [
      componentLine(Identity.new(), 'Nut', Identity.new(), 'Copper Wire'),
    ];

    sut.edit(
      sut.orderNumber(),
      sut.trackingNumber(),
      sut.description(),
      newComponents,
      CORRECTION,
    );

    expect(sut.components()).toEqual(newComponents);
    expect(sut.releaseEvents()).toEqual([
      new BomEdited(
        sut.id.asString(),
        'SO-1234',
        'TN-5678',
        'Daily BOM for order 1234',
        [],
        {
          previous: [
            {
              name: 'Bolt',
              materials: [{ name: 'Steel Rod', weightInGrams: 150 }],
            },
          ],
          current: [
            {
              name: 'Nut',
              materials: [{ name: 'Copper Wire', weightInGrams: 150 }],
            },
          ],
        },
      ),
    ]);
  });

  it('editing a BOM fields and components together records a single event', () => {
    const sut = registerBom();
    sut.releaseEvents();

    sut.edit(
      sut.orderNumber(),
      TrackingNumber.fromString('TN-0000'),
      sut.description(),
      [componentLine(Identity.new(), 'Nut', Identity.new(), 'Copper Wire')],
      CORRECTION,
    );

    expect(sut.releaseEvents()).toHaveLength(1);
  });

  it('editing a BOM with the components it already has records no event', () => {
    const sut = registerBom();
    sut.releaseEvents();

    sut.edit(
      sut.orderNumber(),
      sut.trackingNumber(),
      sut.description(),
      [...sut.components()],
      CORRECTION,
    );

    expect(sut.releaseEvents()).toEqual([]);
  });

  it('rejects editing a BOM to have no components', () => {
    const sut = registerBom();

    expect(() =>
      sut.edit(
        sut.orderNumber(),
        sut.trackingNumber(),
        sut.description(),
        [],
        CORRECTION,
      ),
    ).toThrow();
  });

  it('deleting a BOM records a BomDeleted event carrying the BOM as it stood at deletion', () => {
    const standardBomId = Identity.new();
    const sut = registerBom(standardBomId);
    sut.edit(
      sut.orderNumber(),
      TrackingNumber.fromString('TN-0000'),
      sut.description(),
      undefined,
      CORRECTION,
    );
    sut.releaseEvents();

    sut.delete();

    expect(sut.releaseEvents()).toEqual([
      new BomDeleted(sut.id.asString(), {
        standardBomId: standardBomId.asString(),
        standardBomMiCode: '1234',
        brand: 'Legrand',
        productName: 'Product 1',
        standardLength: 305,
        orderNumber: 'SO-1234',
        trackingNumber: 'TN-0000',
        description: 'Daily BOM for order 1234',
        registeredBy: 'Sina',
        components: [
          {
            name: 'Bolt',
            materials: [{ name: 'Steel Rod', weightInGrams: 150 }],
          },
        ],
      }),
    ]);
  });

  it.each([
    ['an approved', BomReview.approvedBy('مصطفی', null)],
    ['a rejected', BomReview.rejectedBy('مصطفی', 'وزن مس خارج از محدوده است')],
  ])(
    'reconstructing %s BOM that still holds pending review changes is refused',
    (_status, review) => {
      expect(() =>
        Bom.fromPersistence(
          Identity.new(),
          Identity.new(),
          '1234',
          'Legrand',
          'Product 1',
          305,
          OrderNumber.fromString('SO-1234'),
          TrackingNumber.fromString('TN-5678'),
          undefined,
          'Sina',
          [componentLine(Identity.new(), 'Bolt', Identity.new(), 'Steel Rod')],
          review,
          PendingReviewEdits.none().withEdit(
            BomEditRecord.of('مصطفی', AT_TEN, 'خطای ترازو', [
              'شماره ردیابی از TN-1 به TN-5678 تغییر کرد',
            ]),
          ),
          [],
        ),
      ).toThrow('pending review changes');
    },
  );

  it('reconstructing a BOM from persistence records no event', () => {
    const id = Identity.new();
    const standardBomId = Identity.new();
    const components = [
      componentLine(Identity.new(), 'Bolt', Identity.new(), 'Steel Rod'),
    ];

    const sut = Bom.fromPersistence(
      id,
      standardBomId,
      '1234',
      'Legrand',
      'Product 1',
      305,
      OrderNumber.fromString('SO-1234'),
      TrackingNumber.fromString('TN-5678'),
      undefined,
      'Sina',
      components,
      BomReview.approvedBy('مصطفی', null),
      PendingReviewEdits.none(),
      [],
    );

    expect(sut.id.equals(id)).toBe(true);
    expect(sut.approvalStatus()).toBe(ApprovalStatus.Approved);
    expect(sut.reviewedBy()).toBe('مصطفی');
    expect(sut.orderNumber().asString()).toBe('SO-1234');
    expect(sut.releaseEvents()).toEqual([]);
  });

  describe('review', () => {
    it('a newly registered BOM is pending, with no reviewer and no management note', () => {
      const sut = registerBom();

      expect(sut.approvalStatus()).toBe(ApprovalStatus.Pending);
      expect(sut.reviewedBy()).toBeNull();
      expect(sut.managementNote()).toBeNull();
    });

    it('approving a pending BOM makes it approved by the reviewer, with no management note', () => {
      const sut = registerBom();

      sut.approve('مصطفی');

      expect(sut.approvalStatus()).toBe(ApprovalStatus.Approved);
      expect(sut.reviewedBy()).toBe('مصطفی');
      expect(sut.managementNote()).toBeNull();
    });

    it('approving a pending BOM records a BomApproved event carrying the status and reviewer changes', () => {
      const sut = registerBom();
      sut.releaseEvents();

      sut.approve('مصطفی');

      expect(sut.releaseEvents()).toEqual([
        new BomApproved(sut.id.asString(), 'مصطفی', null, 'TN-5678', [
          {
            field: 'approvalStatus',
            previousValue: 'pending',
            newValue: 'approved',
          },
          { field: 'reviewedBy', previousValue: '', newValue: 'مصطفی' },
        ]),
      ]);
    });

    it('approving an approved BOM is refused, leaving its reviewer as it was', () => {
      const sut = approvedBom('مصطفی');

      expect(errorThrownBy(() => sut.approve('یاشار'))).toBeInstanceOf(
        BomAlreadyReviewed,
      );
      expect(sut.approvalStatus()).toBe(ApprovalStatus.Approved);
      expect(sut.reviewedBy()).toBe('مصطفی');
      expect(sut.releaseEvents()).toEqual([]);
    });

    it('approving a rejected BOM is refused, leaving it rejected', () => {
      const sut = rejectedBom('مصطفی');

      expect(errorThrownBy(() => sut.approve('مصطفی'))).toBeInstanceOf(
        BomAlreadyReviewed,
      );
      expect(sut.approvalStatus()).toBe(ApprovalStatus.Rejected);
    });

    it('rejecting a pending BOM makes it rejected by the reviewer, with the trimmed reason as its management note', () => {
      const sut = registerBom();

      sut.reject('مصطفی', '  وزن مس خارج از محدوده است ');

      expect(sut.approvalStatus()).toBe(ApprovalStatus.Rejected);
      expect(sut.reviewedBy()).toBe('مصطفی');
      expect(sut.managementNote()).toBe('وزن مس خارج از محدوده است');
    });

    it('rejecting a pending BOM records a BomRejected event carrying the status, reviewer and management note changes', () => {
      const sut = registerBom();
      sut.releaseEvents();

      sut.reject('مصطفی', 'وزن مس خارج از محدوده است');

      expect(sut.releaseEvents()).toEqual([
        new BomRejected(
          sut.id.asString(),
          'مصطفی',
          'وزن مس خارج از محدوده است',
          'TN-5678',
          [
            {
              field: 'approvalStatus',
              previousValue: 'pending',
              newValue: 'rejected',
            },
            { field: 'reviewedBy', previousValue: '', newValue: 'مصطفی' },
            {
              field: 'managementNote',
              previousValue: '',
              newValue: 'وزن مس خارج از محدوده است',
            },
          ],
        ),
      ]);
    });

    it.each([[''], [' '.repeat(3)]])(
      'rejecting with the reason %p is refused, leaving the BOM pending',
      (reason) => {
        const sut = registerBom();
        sut.releaseEvents();

        expect(errorThrownBy(() => sut.reject('مصطفی', reason))).toBeInstanceOf(
          RejectionReasonRequired,
        );
        expect(sut.approvalStatus()).toBe(ApprovalStatus.Pending);
        expect(sut.releaseEvents()).toEqual([]);
      },
    );

    it('rejecting an approved BOM is refused, leaving it approved', () => {
      const sut = approvedBom('مصطفی');

      expect(errorThrownBy(() => sut.reject('مصطفی', 'دلیل'))).toBeInstanceOf(
        BomAlreadyReviewed,
      );
      expect(sut.approvalStatus()).toBe(ApprovalStatus.Approved);
    });

    it('rejecting a rejected BOM is refused, keeping its first reason', () => {
      const sut = rejectedBom('مصطفی', 'دلیل اول');

      expect(
        errorThrownBy(() => sut.reject('یاشار', 'دلیل دوم')),
      ).toBeInstanceOf(BomAlreadyReviewed);
      expect(sut.managementNote()).toBe('دلیل اول');
    });

    it.each([
      ['a reviewer', REVIEW_EDIT],
      ['an inspector', CORRECTION],
    ])(
      'editing a field of an approved BOM sends it back to pending, with no reviewer and no note (edited by %s)',
      (_editorName, editor) => {
        const sut = approvedBom('مصطفی');

        sut.edit(
          sut.orderNumber(),
          TrackingNumber.fromString('TN-0000'),
          sut.description(),
          undefined,
          editor,
        );

        expect(sut.approvalStatus()).toBe(ApprovalStatus.Pending);
        expect(sut.reviewedBy()).toBeNull();
        expect(sut.managementNote()).toBeNull();
      },
    );

    it('editing an approved BOM records the BomEdited event, then a BomReturnedToPending event naming the BOM by its tracking number after the edit', () => {
      const sut = approvedBom('مصطفی');

      sut.edit(
        sut.orderNumber(),
        TrackingNumber.fromString('TN-0000'),
        sut.description(),
        undefined,
        CORRECTION,
      );

      expect(sut.releaseEvents()).toEqual([
        new BomEdited(
          sut.id.asString(),
          'SO-1234',
          'TN-0000',
          'Daily BOM for order 1234',
          [
            {
              field: 'trackingNumber',
              previousValue: 'TN-5678',
              newValue: 'TN-0000',
            },
          ],
        ),
        new BomReturnedToPending(sut.id.asString(), 'TN-0000', [
          {
            field: 'approvalStatus',
            previousValue: 'approved',
            newValue: 'pending',
          },
          { field: 'reviewedBy', previousValue: 'مصطفی', newValue: '' },
        ]),
      ]);
    });

    it('editing a rejected BOM sends it back to pending, the returned-to-pending event clearing its management note too', () => {
      const sut = rejectedBom('مصطفی', 'وزن مس خارج از محدوده است');

      sut.edit(
        sut.orderNumber(),
        TrackingNumber.fromString('TN-0000'),
        sut.description(),
        undefined,
        CORRECTION,
      );

      expect(sut.approvalStatus()).toBe(ApprovalStatus.Pending);
      expect(sut.releaseEvents()[1]).toEqual(
        new BomReturnedToPending(sut.id.asString(), 'TN-0000', [
          {
            field: 'approvalStatus',
            previousValue: 'rejected',
            newValue: 'pending',
          },
          { field: 'reviewedBy', previousValue: 'مصطفی', newValue: '' },
          {
            field: 'managementNote',
            previousValue: 'وزن مس خارج از محدوده است',
            newValue: '',
          },
        ]),
      );
    });

    it('replacing the composition of an approved BOM records an edit with no review lines, then a BomReturnedToPending event', () => {
      const sut = approvedBom('مصطفی');

      sut.edit(
        sut.orderNumber(),
        sut.trackingNumber(),
        sut.description(),
        [componentLine(Identity.new(), 'Nut', Identity.new(), 'Copper Wire')],
        CORRECTION,
      );

      const [edited, returned] = sut.releaseEvents();
      expect((edited as BomEdited).changes).toEqual([]);
      expect(returned).toBeInstanceOf(BomReturnedToPending);
      expect(sut.approvalStatus()).toBe(ApprovalStatus.Pending);
    });

    it('an edit that changes nothing leaves an approved BOM approved by the same reviewer', () => {
      const sut = approvedBom('مصطفی');

      sut.edit(
        sut.orderNumber(),
        sut.trackingNumber(),
        sut.description(),
        [...sut.components()],
        CORRECTION,
      );

      expect(sut.approvalStatus()).toBe(ApprovalStatus.Approved);
      expect(sut.reviewedBy()).toBe('مصطفی');
      expect(sut.releaseEvents()).toEqual([]);
    });

    it('editing a pending BOM records only the BomEdited event', () => {
      const sut = registerBom();
      sut.releaseEvents();

      sut.edit(
        sut.orderNumber(),
        TrackingNumber.fromString('TN-0000'),
        sut.description(),
        undefined,
        REVIEW_EDIT,
      );

      const events = sut.releaseEvents();
      expect(events).toHaveLength(1);
      expect(events[0]).toBeInstanceOf(BomEdited);
    });

    it('a refused edit leaves an approved BOM approved by the same reviewer', () => {
      const sut = approvedBom('مصطفی');

      expect(() =>
        sut.edit(
          OrderNumber.fromString('SO-9999'),
          sut.trackingNumber(),
          sut.description(),
          [],
          CORRECTION,
        ),
      ).toThrow();
      expect(sut.approvalStatus()).toBe(ApprovalStatus.Approved);
      expect(sut.reviewedBy()).toBe('مصطفی');
    });

    it('an approved BOM sent back to pending by an edit can be approved again', () => {
      const sut = approvedBom('مصطفی');
      sut.edit(
        sut.orderNumber(),
        TrackingNumber.fromString('TN-0000'),
        sut.description(),
        undefined,
        CORRECTION,
      );

      sut.approve('یاشار');

      expect(sut.approvalStatus()).toBe(ApprovalStatus.Approved);
      expect(sut.reviewedBy()).toBe('یاشار');
    });

    describe('management note from review edits', () => {
      it('approving after a review edit of a weight notes its heading, then the change', () => {
        const sut = registerBom();
        sut.edit(
          sut.orderNumber(),
          sut.trackingNumber(),
          sut.description(),
          reweighed(sut, 120),
          REVIEW_EDIT,
        );

        sut.approve('مصطفی');

        expect(sut.managementNote()).toBe(
          [
            REVIEW_HEADING,
            'وزن جز Bolt مواد اولیه Steel Rod از 150 به 120 تغییر کرد',
          ].join('\n'),
        );
      });

      it('a review edit of a field and a weight notes the field first', () => {
        const sut = registerBom();
        sut.edit(
          OrderNumber.fromString('SO-9999'),
          sut.trackingNumber(),
          sut.description(),
          reweighed(sut, 120),
          REVIEW_EDIT,
        );

        sut.approve('مصطفی');

        expect(sut.managementNote()).toBe(
          [
            REVIEW_HEADING,
            'شماره سفارش از SO-1234 به SO-9999 تغییر کرد',
            'وزن جز Bolt مواد اولیه Steel Rod از 150 به 120 تغییر کرد',
          ].join('\n'),
        );
      });

      it('approving with a note records the note in the BomApproved event', () => {
        const sut = registerBom();
        sut.edit(
          sut.orderNumber(),
          sut.trackingNumber(),
          sut.description(),
          reweighed(sut, 120),
          REVIEW_EDIT,
        );
        sut.releaseEvents();

        sut.approve('مصطفی');

        const note = [
          REVIEW_HEADING,
          'وزن جز Bolt مواد اولیه Steel Rod از 150 به 120 تغییر کرد',
        ].join('\n');
        expect(sut.releaseEvents()).toEqual([
          new BomApproved(sut.id.asString(), 'مصطفی', note, 'TN-5678', [
            {
              field: 'approvalStatus',
              previousValue: 'pending',
              newValue: 'approved',
            },
            { field: 'reviewedBy', previousValue: '', newValue: 'مصطفی' },
            { field: 'managementNote', previousValue: '', newValue: note },
          ]),
        ]);
      });

      it('successive review edits are noted as one block each, in the order they were made', () => {
        const sut = registerBom();
        sut.edit(
          sut.orderNumber(),
          sut.trackingNumber(),
          sut.description(),
          reweighed(sut, 120),
          REVIEW_EDIT,
        );
        sut.edit(
          sut.orderNumber(),
          sut.trackingNumber(),
          sut.description(),
          reweighed(sut, 100),
          reviewEditBy(
            'یاشار',
            'بازبینی دوباره',
            new Date('2024-09-05T08:00:00.000Z'),
          ),
        );

        sut.approve('مصطفی');

        expect(sut.managementNote()).toBe(
          [
            REVIEW_HEADING,
            'وزن جز Bolt مواد اولیه Steel Rod از 150 به 120 تغییر کرد',
            'کاربر یاشار در 1403/06/15 ساعت 11:30 به علت بازبینی دوباره تغییرات زیر را انجام داد',
            'وزن جز Bolt مواد اولیه Steel Rod از 120 به 100 تغییر کرد',
          ].join('\n'),
        );
      });

      it('a material added by a review edit is noted as an addition', () => {
        const sut = registerBom();
        const [bolt] = sut.components();
        const zinc = Identity.fromString('material-zinc');
        sut.edit(
          sut.orderNumber(),
          sut.trackingNumber(),
          sut.description(),
          [
            BomComponentLine.of(bolt.componentId(), 'Bolt', [
              ...bolt.materials(),
              BomMaterialLine.of(zinc, 'Zinc', Weight.ofGrams(2.5)),
            ]),
          ],
          REVIEW_EDIT,
        );

        sut.approve('مصطفی');

        expect(sut.managementNote()).toBe(
          [
            REVIEW_HEADING,
            'مواد اولیه Zinc با وزن 2.5 به جز Bolt اضافه شد',
          ].join('\n'),
        );
      });

      it('a component swapped by a review edit is noted as the new material added, then the old one removed', () => {
        const sut = registerBom();
        sut.edit(
          sut.orderNumber(),
          sut.trackingNumber(),
          sut.description(),
          [componentLine(Identity.new(), 'Nut', Identity.new(), 'Copper Wire')],
          REVIEW_EDIT,
        );

        sut.approve('مصطفی');

        expect(sut.managementNote()).toBe(
          [
            REVIEW_HEADING,
            'مواد اولیه Copper Wire با وزن 150 به جز Nut اضافه شد',
            'مواد اولیه Steel Rod با وزن 150 از جز Bolt حذف شد',
          ].join('\n'),
        );
      });

      it('a correction is not noted', () => {
        const sut = registerBom();
        sut.edit(
          sut.orderNumber(),
          sut.trackingNumber(),
          sut.description(),
          reweighed(sut, 120),
          CORRECTION,
        );

        sut.approve('مصطفی');

        expect(sut.managementNote()).toBeNull();
      });

      it('a reviewer’s correction from the daily BOMs page is not noted', () => {
        const sut = registerBom();
        sut.edit(
          sut.orderNumber(),
          sut.trackingNumber(),
          sut.description(),
          reweighed(sut, 120),
          BomEditContext.of(
            'مصطفی',
            BomEditor.withRole(Role.Management),
            BomEditSource.DailyBoms,
            'خطای ترازو',
            AT_TEN,
          ),
        );

        sut.approve('مصطفی');

        expect(sut.managementNote()).toBeNull();
      });

      it('a correction after a review edit leaves the review edit in the note', () => {
        const sut = registerBom();
        sut.edit(
          sut.orderNumber(),
          sut.trackingNumber(),
          sut.description(),
          reweighed(sut, 120),
          REVIEW_EDIT,
        );
        sut.edit(
          sut.orderNumber(),
          TrackingNumber.fromString('TN-0000'),
          sut.description(),
          undefined,
          CORRECTION,
        );

        sut.approve('مصطفی');

        expect(sut.managementNote()).toBe(
          [
            REVIEW_HEADING,
            'وزن جز Bolt مواد اولیه Steel Rod از 150 به 120 تغییر کرد',
          ].join('\n'),
        );
      });

      it('a review edit that changes nothing is not noted', () => {
        const sut = registerBom();
        sut.edit(
          sut.orderNumber(),
          sut.trackingNumber(),
          sut.description(),
          reweighed(sut, 150),
          REVIEW_EDIT,
        );

        sut.approve('مصطفی');

        expect(sut.managementNote()).toBeNull();
      });

      it('a note shows only the review edits of the last review', () => {
        const sut = registerBom();
        sut.edit(
          sut.orderNumber(),
          sut.trackingNumber(),
          sut.description(),
          reweighed(sut, 120),
          REVIEW_EDIT,
        );
        sut.approve('مصطفی');
        sut.edit(
          sut.orderNumber(),
          sut.trackingNumber(),
          sut.description(),
          reweighed(sut, 100),
          REVIEW_EDIT,
        );

        sut.approve('مصطفی');

        expect(sut.managementNote()).toBe(
          [
            REVIEW_HEADING,
            'وزن جز Bolt مواد اولیه Steel Rod از 120 به 100 تغییر کرد',
          ].join('\n'),
        );
      });

      it('rejecting uses the typed reason as the note and discards the review edits', () => {
        const sut = registerBom();
        sut.edit(
          sut.orderNumber(),
          sut.trackingNumber(),
          sut.description(),
          reweighed(sut, 120),
          REVIEW_EDIT,
        );
        sut.reject('مصطفی', 'وزن مس خارج از محدوده است');
        sut.edit(
          sut.orderNumber(),
          TrackingNumber.fromString('TN-0000'),
          sut.description(),
          undefined,
          REVIEW_EDIT,
        );

        sut.approve('مصطفی');

        expect(sut.managementNote()).toBe(
          [REVIEW_HEADING, 'شماره ردیابی از TN-5678 به TN-0000 تغییر کرد'].join(
            '\n',
          ),
        );
      });

      it('approving discards the review’s edits once they are noted', () => {
        const sut = registerBom();
        sut.edit(
          sut.orderNumber(),
          sut.trackingNumber(),
          sut.description(),
          reweighed(sut, 120),
          REVIEW_EDIT,
        );

        sut.approve('مصطفی');

        expect(sut.pendingReviewEdits().isEmpty()).toBe(true);
      });

      it('a review edit never enters the edit details', () => {
        const sut = registerBom();

        sut.edit(
          sut.orderNumber(),
          sut.trackingNumber(),
          sut.description(),
          reweighed(sut, 120),
          REVIEW_EDIT,
        );

        expect(sut.editHistory()).toEqual([]);
      });
    });
  });

  describe('edit reason', () => {
    const NO_REASON = BomEditContext.of(
      'نیکروش',
      BomEditor.withRole(Role.QcInspector),
      BomEditSource.DailyBoms,
      '  ',
      AT_TEN,
    );

    it('an edit that changes something without a reason is refused', () => {
      const sut = registerBom();

      expect(
        errorThrownBy(() =>
          sut.edit(
            sut.orderNumber(),
            TrackingNumber.fromString('TN-0000'),
            sut.description(),
            undefined,
            NO_REASON,
          ),
        ),
      ).toBeInstanceOf(EditReasonRequired);
    });

    it('an edit refused for its missing reason changes nothing and records nothing', () => {
      const sut = approvedBom('مصطفی');

      errorThrownBy(() =>
        sut.edit(
          OrderNumber.fromString('SO-9999'),
          TrackingNumber.fromString('TN-0000'),
          'Updated description',
          reweighed(sut, 120),
          NO_REASON,
        ),
      );

      expect([
        sut.orderNumber().asString(),
        sut.trackingNumber().asString(),
        sut.description(),
        sut.components()[0].materials()[0].weight().asGrams(),
        sut.approvalStatus(),
        sut.reviewedBy(),
        sut.editHistory(),
        sut.releaseEvents(),
      ]).toEqual([
        'SO-1234',
        'TN-5678',
        'Daily BOM for order 1234',
        150,
        ApprovalStatus.Approved,
        'مصطفی',
        [],
        [],
      ]);
    });

    it('an edit that changes nothing needs no reason', () => {
      const sut = registerBom();
      sut.releaseEvents();

      sut.edit(
        sut.orderNumber(),
        sut.trackingNumber(),
        sut.description(),
        reweighed(sut, 150),
        NO_REASON,
      );

      expect(sut.releaseEvents()).toEqual([]);
    });
    describe('a composition re-cloned with nothing to show (renamed names, another line order)', () => {
      it('is no edit: it needs no reason, records nothing and leaves an approved BOM approved', () => {
        const sut = approvedBom('مصطفی');

        sut.edit(
          sut.orderNumber(),
          sut.trackingNumber(),
          sut.description(),
          renamed(sut),
          NO_REASON,
        );

        expect([
          sut.releaseEvents(),
          sut.approvalStatus(),
          sut.reviewedBy(),
          sut.editHistory(),
        ]).toEqual([[], ApprovalStatus.Approved, 'مصطفی', []]);
      });

      it('quietly adopts the re-cloned names', () => {
        const sut = registerBom();

        sut.edit(
          sut.orderNumber(),
          sut.trackingNumber(),
          sut.description(),
          renamed(sut),
          NO_REASON,
        );

        expect(
          sut
            .components()
            .map((component) => [
              component.name(),
              ...component.materials().map((material) => material.name()),
            ]),
        ).toEqual([['Bolt (renamed)', 'Steel Rod (renamed)']]);
      });

      it('is no edit when only the line order differs', () => {
        const bolt = componentLine(
          Identity.new(),
          'Bolt',
          Identity.new(),
          'Steel Rod',
        );
        const nut = componentLine(
          Identity.new(),
          'Nut',
          Identity.new(),
          'Copper Wire',
        );
        const sut = Bom.register(
          Identity.new(),
          '1234',
          'Legrand',
          'Product 1',
          305,
          OrderNumber.fromString('SO-1234'),
          TrackingNumber.fromString('TN-5678'),
          undefined,
          'Sina',
          [bolt, nut],
        );
        sut.releaseEvents();

        sut.edit(
          sut.orderNumber(),
          sut.trackingNumber(),
          sut.description(),
          [nut, bolt],
          NO_REASON,
        );

        expect(sut.releaseEvents()).toEqual([]);
      });
    });
  });

  describe('edit details («جزئیات ویرایش»)', () => {
    it('a correction is recorded with who made it, when, why and its change lines', () => {
      const sut = registerBom();

      sut.edit(
        OrderNumber.fromString('SO-9999'),
        sut.trackingNumber(),
        'Updated description',
        reweighed(sut, 120),
        CORRECTION,
      );

      expect(sut.editHistory()).toEqual([
        BomEditRecord.of('نیکروش', AT_TEN, 'اصلاح ثبت', [
          'شماره سفارش از SO-1234 به SO-9999 تغییر کرد',
          'توضیحات از Daily BOM for order 1234 به Updated description تغییر کرد',
          'وزن جز Bolt مواد اولیه Steel Rod از 150 به 120 تغییر کرد',
        ]),
      ]);
    });

    it('a later correction is appended after the earlier ones, each with only its own changes', () => {
      const sut = registerBom();
      sut.edit(
        sut.orderNumber(),
        sut.trackingNumber(),
        sut.description(),
        reweighed(sut, 120),
        CORRECTION,
      );

      sut.edit(
        sut.orderNumber(),
        sut.trackingNumber(),
        sut.description(),
        reweighed(sut, 100),
        CORRECTION,
      );

      expect(sut.editHistory().map((record) => record.changes())).toEqual([
        ['وزن جز Bolt مواد اولیه Steel Rod از 150 به 120 تغییر کرد'],
        ['وزن جز Bolt مواد اولیه Steel Rod از 120 به 100 تغییر کرد'],
      ]);
    });

    it('a correction that changes nothing is not recorded', () => {
      const sut = registerBom();

      sut.edit(
        sut.orderNumber(),
        sut.trackingNumber(),
        sut.description(),
        undefined,
        CORRECTION,
      );

      expect(sut.editHistory()).toEqual([]);
    });

    it('a newly registered BOM has no edit details', () => {
      expect(registerBom().editHistory()).toEqual([]);
    });
  });
});

describe('re-sampling a daily BOM («نمونه گیری مجدد»)', () => {
  const RESAMPLED_STANDARD_BOM_ID = Identity.new();
  const COPPER_LINE = componentLine(
    Identity.new(),
    'مغزی',
    Identity.new(),
    'مس',
  );

  function resampleOf(source: Bom, isLatestOfTrackingNumber = true): Bom {
    return source.resample(
      isLatestOfTrackingNumber,
      RESAMPLED_STANDARD_BOM_ID,
      'Legrand',
      'Product 1',
      305,
      [COPPER_LINE],
      'نمونه دوم',
      'یاشار',
    );
  }

  it('registers a new pending daily BOM for the rejected one’s order number, tracking number and MI code', () => {
    const source = rejectedBom();

    const sut = resampleOf(source);

    expect(sut.id.equals(source.id)).toBe(false);
    expect(sut.orderNumber().asString()).toBe('SO-1234');
    expect(sut.trackingNumber().asString()).toBe('TN-5678');
    expect(sut.standardBomMiCode()).toBe('1234');
    expect(sut.standardBomId()).toBe(RESAMPLED_STANDARD_BOM_ID);
    expect(sut.components()).toEqual([COPPER_LINE]);
    expect(sut.description()).toBe('نمونه دوم');
    expect(sut.registeredBy()).toBe('یاشار');
    expect(sut.approvalStatus()).toBe(ApprovalStatus.Pending);
  });

  it('records the new daily BOM’s registration', () => {
    const sut = resampleOf(rejectedBom());

    const events = sut.releaseEvents();
    expect(events).toHaveLength(1);
    expect(events[0]).toBeInstanceOf(BomRegistered);
    expect(events[0]).toEqual(
      expect.objectContaining({ bomId: sut.id.asString() }),
    );
  });

  it('leaves the rejected daily BOM as it was, recording nothing on it', () => {
    const source = rejectedBom();

    resampleOf(source);

    expect(source.approvalStatus()).toBe(ApprovalStatus.Rejected);
    expect(source.managementNote()).toBe('وزن مس خارج از محدوده است');
    expect(source.releaseEvents()).toEqual([]);
  });

  it('is refused as not the latest once another daily BOM of its tracking number was registered after it', () => {
    const error = errorThrownBy(() => resampleOf(rejectedBom(), false));

    expect(error).toBeInstanceOf(BomNotResamplable);
    expect(error).toEqual(
      expect.objectContaining({
        reason: 'not-latest',
        approvalStatus: ApprovalStatus.Rejected,
      }),
    );
  });

  it.each([
    ['approved', approvedBom],
    ['pending', () => registerBom()],
  ])(
    'is refused as not rejected for a daily BOM that is %s',
    (status, source) => {
      const error = errorThrownBy(() => resampleOf(source()));

      expect(error).toBeInstanceOf(BomNotResamplable);
      expect(error).toEqual(
        expect.objectContaining({
          reason: 'not-rejected',
          approvalStatus: status,
        }),
      );
    },
  );
});
