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
import { RejectionReasonRequired } from './exceptions/rejection-reason-required.exception';
import { ApprovalStatus } from './value/approval-status';
import { BomComponentLine } from './value/bom-component-line.vo';
import { BomEditor } from './value/bom-editor.vo';
import { BomMaterialLine } from './value/bom-material-line.vo';
import { BomReview } from './value/bom-review.vo';
import { OrderNumber } from './value/order-number.vo';
import { PendingReviewChanges } from './value/pending-review-changes.vo';
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

// A reviewer (management) and a non-reviewer (QC inspector) as editors —
// only edits by any reviewer make up a review's management note.
const BY_REVIEWER = BomEditor.withRole(Role.Management);
const BY_INSPECTOR = BomEditor.withRole(Role.QcInspector);

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
      BY_INSPECTOR,
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
      BY_INSPECTOR,
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
      BY_INSPECTOR,
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
      BY_INSPECTOR,
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
      BY_INSPECTOR,
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
      BY_INSPECTOR,
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
      BY_INSPECTOR,
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
        BY_INSPECTOR,
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
      BY_INSPECTOR,
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
          PendingReviewChanges.restore([
            {
              kind: 'field',
              field: 'trackingNumber',
              previousValue: 'TN-1',
              newValue: 'TN-5678',
            },
          ]),
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
      PendingReviewChanges.none(),
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
      ['a reviewer', BY_REVIEWER],
      ['an inspector', BY_INSPECTOR],
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
        BY_INSPECTOR,
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
        BY_INSPECTOR,
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
        BY_INSPECTOR,
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
        BY_INSPECTOR,
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
        BY_REVIEWER,
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
          BY_INSPECTOR,
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
        BY_INSPECTOR,
      );

      sut.approve('یاشار');

      expect(sut.approvalStatus()).toBe(ApprovalStatus.Approved);
      expect(sut.reviewedBy()).toBe('یاشار');
    });

    describe('management note from edits by any reviewer', () => {
      it('approving after a reviewer changed a weight notes the change', () => {
        const sut = registerBom();
        sut.edit(
          sut.orderNumber(),
          sut.trackingNumber(),
          sut.description(),
          reweighed(sut, 120),
          BY_REVIEWER,
        );

        sut.approve('مصطفی');

        expect(sut.managementNote()).toBe(
          'وزن جز Bolt مواد اولیه Steel Rod از 150 به 120 تغییر کرد',
        );
      });

      it('approving after a reviewer changed a field and a weight notes both', () => {
        const sut = registerBom();
        sut.edit(
          OrderNumber.fromString('SO-9999'),
          sut.trackingNumber(),
          sut.description(),
          reweighed(sut, 120),
          BY_REVIEWER,
        );

        sut.approve('مصطفی');

        expect(sut.managementNote()).toBe(
          [
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
          BY_REVIEWER,
        );
        sut.releaseEvents();

        sut.approve('مصطفی');

        const note = 'وزن جز Bolt مواد اولیه Steel Rod از 150 به 120 تغییر کرد';
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

      it('a reviewer’s successive edits note each value from where it started to where it ended', () => {
        const sut = registerBom();
        sut.edit(
          sut.orderNumber(),
          sut.trackingNumber(),
          sut.description(),
          reweighed(sut, 120),
          BY_REVIEWER,
        );
        sut.edit(
          sut.orderNumber(),
          sut.trackingNumber(),
          sut.description(),
          reweighed(sut, 100),
          BY_REVIEWER,
        );

        sut.approve('مصطفی');

        expect(sut.managementNote()).toBe(
          'وزن جز Bolt مواد اولیه Steel Rod از 150 به 100 تغییر کرد',
        );
      });

      it('a material the reviewer added is noted as an addition', () => {
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
          BY_REVIEWER,
        );

        sut.approve('مصطفی');

        expect(sut.managementNote()).toBe(
          'مواد اولیه Zinc با وزن 2.5 به جز Bolt اضافه شد',
        );
      });

      it('a component the reviewer swapped is noted as its material removed and the new one added', () => {
        const sut = registerBom();
        sut.edit(
          sut.orderNumber(),
          sut.trackingNumber(),
          sut.description(),
          [componentLine(Identity.new(), 'Nut', Identity.new(), 'Copper Wire')],
          BY_REVIEWER,
        );

        sut.approve('مصطفی');

        expect(sut.managementNote()).toBe(
          [
            'مواد اولیه Copper Wire با وزن 150 به جز Nut اضافه شد',
            'مواد اولیه Steel Rod با وزن 150 از جز Bolt حذف شد',
          ].join('\n'),
        );
      });

      it('an inspector’s edit is not noted', () => {
        const sut = registerBom();
        sut.edit(
          sut.orderNumber(),
          sut.trackingNumber(),
          sut.description(),
          reweighed(sut, 120),
          BY_INSPECTOR,
        );

        sut.approve('مصطفی');

        expect(sut.managementNote()).toBeNull();
      });

      it('an inspector’s edit after a reviewer’s discards the reviewer edits from the note', () => {
        const sut = registerBom();
        sut.edit(
          sut.orderNumber(),
          sut.trackingNumber(),
          sut.description(),
          reweighed(sut, 120),
          BY_REVIEWER,
        );
        sut.edit(
          sut.orderNumber(),
          TrackingNumber.fromString('TN-0000'),
          sut.description(),
          undefined,
          BY_INSPECTOR,
        );

        sut.approve('مصطفی');

        expect(sut.managementNote()).toBeNull();
      });

      it('an edit that changes nothing keeps the edits by any reviewer in the note', () => {
        const sut = registerBom();
        sut.edit(
          sut.orderNumber(),
          sut.trackingNumber(),
          sut.description(),
          reweighed(sut, 120),
          BY_REVIEWER,
        );
        sut.edit(
          sut.orderNumber(),
          sut.trackingNumber(),
          sut.description(),
          undefined,
          BY_INSPECTOR,
        );

        sut.approve('مصطفی');

        expect(sut.managementNote()).toBe(
          'وزن جز Bolt مواد اولیه Steel Rod از 150 به 120 تغییر کرد',
        );
      });

      it('a value the reviewer changed back to where it started is not noted', () => {
        const sut = registerBom();
        sut.edit(
          sut.orderNumber(),
          sut.trackingNumber(),
          sut.description(),
          reweighed(sut, 120),
          BY_REVIEWER,
        );
        sut.edit(
          sut.orderNumber(),
          sut.trackingNumber(),
          sut.description(),
          reweighed(sut, 150),
          BY_REVIEWER,
        );

        sut.approve('مصطفی');

        expect(sut.managementNote()).toBeNull();
      });

      it('a note shows only the edits of the last review', () => {
        const sut = registerBom();
        sut.edit(
          sut.orderNumber(),
          sut.trackingNumber(),
          sut.description(),
          reweighed(sut, 120),
          BY_REVIEWER,
        );
        sut.approve('مصطفی');
        sut.edit(
          sut.orderNumber(),
          TrackingNumber.fromString('TN-0000'),
          sut.description(),
          undefined,
          BY_INSPECTOR,
        );
        sut.edit(
          sut.orderNumber(),
          sut.trackingNumber(),
          sut.description(),
          reweighed(sut, 100),
          BY_REVIEWER,
        );

        sut.approve('مصطفی');

        expect(sut.managementNote()).toBe(
          'وزن جز Bolt مواد اولیه Steel Rod از 120 به 100 تغییر کرد',
        );
      });

      it('a reviewer’s edit of an approved BOM begins the next review’s note', () => {
        const sut = approvedBom('مصطفی');
        sut.edit(
          sut.orderNumber(),
          sut.trackingNumber(),
          sut.description(),
          reweighed(sut, 120),
          BY_REVIEWER,
        );

        sut.approve('مصطفی');

        expect(sut.managementNote()).toBe(
          'وزن جز Bolt مواد اولیه Steel Rod از 150 به 120 تغییر کرد',
        );
      });

      it('rejecting uses the typed reason as the note and discards the edits by any reviewer', () => {
        const sut = registerBom();
        sut.edit(
          sut.orderNumber(),
          sut.trackingNumber(),
          sut.description(),
          reweighed(sut, 120),
          BY_REVIEWER,
        );
        sut.reject('مصطفی', 'وزن مس خارج از محدوده است');
        sut.edit(
          sut.orderNumber(),
          TrackingNumber.fromString('TN-0000'),
          sut.description(),
          undefined,
          BY_REVIEWER,
        );

        sut.approve('مصطفی');

        expect(sut.managementNote()).toBe(
          'شماره ردیابی از TN-5678 به TN-0000 تغییر کرد',
        );
      });

      it('approving discards the review’s edits once they are noted', () => {
        const sut = registerBom();
        sut.edit(
          sut.orderNumber(),
          sut.trackingNumber(),
          sut.description(),
          reweighed(sut, 120),
          BY_REVIEWER,
        );

        sut.approve('مصطفی');

        expect(sut.pendingReviewChanges().isEmpty()).toBe(true);
      });
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
