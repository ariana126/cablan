import { Identity } from '@framework/domain';

import { Bom } from './bom.aggregate';
import { BomApprovalRevoked } from './events/bom-approval-revoked.event';
import { BomApproved } from './events/bom-approved.event';
import { BomDeleted } from './events/bom-deleted.event';
import { BomEdited } from './events/bom-edited.event';
import { BomRegistered } from './events/bom-registered.event';
import { ApprovalStatus } from './value/approval-status';
import { BomApproval } from './value/bom-approval.vo';
import { BomComponentLine } from './value/bom-component-line.vo';
import { BomMaterialLine } from './value/bom-material-line.vo';
import { OrderNumber } from './value/order-number.vo';
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

function approvedBom(approverName = 'مصطفی'): Bom {
  const bom = registerBom();
  bom.approve(approverName);
  bom.releaseEvents();
  return bom;
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

    sut.edit(sut.orderNumber(), sut.trackingNumber(), sut.description());

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
    );

    expect(sut.releaseEvents()).toHaveLength(1);
  });

  it('editing a BOM with the components it already has records no event', () => {
    const sut = registerBom();
    sut.releaseEvents();

    sut.edit(sut.orderNumber(), sut.trackingNumber(), sut.description(), [
      ...sut.components(),
    ]);

    expect(sut.releaseEvents()).toEqual([]);
  });

  it('rejects editing a BOM to have no components', () => {
    const sut = registerBom();

    expect(() =>
      sut.edit(sut.orderNumber(), sut.trackingNumber(), sut.description(), []),
    ).toThrow();
  });

  it('deleting a BOM records a BomDeleted event carrying the BOM as it stood at deletion', () => {
    const standardBomId = Identity.new();
    const sut = registerBom(standardBomId);
    sut.edit(
      sut.orderNumber(),
      TrackingNumber.fromString('TN-0000'),
      sut.description(),
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
      BomApproval.by('مصطفی'),
    );

    expect(sut.id.equals(id)).toBe(true);
    expect(sut.approvalStatus()).toBe(ApprovalStatus.Approved);
    expect(sut.approvedBy()).toBe('مصطفی');
    expect(sut.orderNumber().asString()).toBe('SO-1234');
    expect(sut.releaseEvents()).toEqual([]);
  });

  describe('approval', () => {
    it('a newly registered BOM is unapproved, with no approver', () => {
      const sut = registerBom();

      expect(sut.approvalStatus()).toBe(ApprovalStatus.Unapproved);
      expect(sut.approvedBy()).toBeNull();
    });

    it('approving an unapproved BOM makes it approved by the approver', () => {
      const sut = registerBom();

      sut.approve('مصطفی');

      expect(sut.approvalStatus()).toBe(ApprovalStatus.Approved);
      expect(sut.approvedBy()).toBe('مصطفی');
    });

    it('approving an unapproved BOM records a BomApproved event carrying the status and approver changes', () => {
      const sut = registerBom();
      sut.releaseEvents();

      sut.approve('مصطفی');

      expect(sut.releaseEvents()).toEqual([
        new BomApproved(sut.id.asString(), 'مصطفی', [
          {
            field: 'approvalStatus',
            previousValue: 'unapproved',
            newValue: 'approved',
          },
          { field: 'approvedBy', previousValue: '', newValue: 'مصطفی' },
        ]),
      ]);
    });

    it('approving an already approved BOM keeps its original approver', () => {
      const sut = approvedBom('مصطفی');

      sut.approve('یاشار');

      expect(sut.approvalStatus()).toBe(ApprovalStatus.Approved);
      expect(sut.approvedBy()).toBe('مصطفی');
    });

    it('approving an already approved BOM records no event', () => {
      const sut = approvedBom('مصطفی');

      sut.approve('یاشار');

      expect(sut.releaseEvents()).toEqual([]);
    });

    it('revoking an approved BOM’s approval makes it unapproved, with no approver', () => {
      const sut = approvedBom('مصطفی');

      sut.revokeApproval();

      expect(sut.approvalStatus()).toBe(ApprovalStatus.Unapproved);
      expect(sut.approvedBy()).toBeNull();
    });

    it('revoking an approved BOM’s approval records a BomApprovalRevoked event carrying the status and approver changes', () => {
      const sut = approvedBom('مصطفی');

      sut.revokeApproval();

      expect(sut.releaseEvents()).toEqual([
        new BomApprovalRevoked(sut.id.asString(), [
          {
            field: 'approvalStatus',
            previousValue: 'approved',
            newValue: 'unapproved',
          },
          { field: 'approvedBy', previousValue: 'مصطفی', newValue: '' },
        ]),
      ]);
    });

    it('revoking an unapproved BOM’s approval records no event', () => {
      const sut = registerBom();
      sut.releaseEvents();

      sut.revokeApproval();

      expect(sut.releaseEvents()).toEqual([]);
    });

    it('an approved BOM can be approved again after its approval was revoked', () => {
      const sut = approvedBom('مصطفی');
      sut.revokeApproval();

      sut.approve('یاشار');

      expect(sut.approvedBy()).toBe('یاشار');
    });

    it('editing a field of an approved BOM sends it back to unapproved, with no approver', () => {
      const sut = approvedBom('مصطفی');

      sut.edit(
        sut.orderNumber(),
        TrackingNumber.fromString('TN-0000'),
        sut.description(),
      );

      expect(sut.approvalStatus()).toBe(ApprovalStatus.Unapproved);
      expect(sut.approvedBy()).toBeNull();
    });

    it('editing a field of an approved BOM records the approval reset in the same BomEdited event, after the field changes', () => {
      const sut = approvedBom('مصطفی');

      sut.edit(
        sut.orderNumber(),
        TrackingNumber.fromString('TN-0000'),
        sut.description(),
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
            {
              field: 'approvalStatus',
              previousValue: 'approved',
              newValue: 'unapproved',
            },
            { field: 'approvedBy', previousValue: 'مصطفی', newValue: '' },
          ],
        ),
      ]);
    });

    it('replacing the composition of an approved BOM sends it back to unapproved', () => {
      const sut = approvedBom('مصطفی');

      sut.edit(sut.orderNumber(), sut.trackingNumber(), sut.description(), [
        componentLine(Identity.new(), 'Nut', Identity.new(), 'Copper Wire'),
      ]);

      expect(sut.approvalStatus()).toBe(ApprovalStatus.Unapproved);
      const [event] = sut.releaseEvents() as BomEdited[];
      expect(event.changes).toEqual([
        {
          field: 'approvalStatus',
          previousValue: 'approved',
          newValue: 'unapproved',
        },
        { field: 'approvedBy', previousValue: 'مصطفی', newValue: '' },
      ]);
    });

    it('an edit that changes nothing leaves an approved BOM approved by the same approver', () => {
      const sut = approvedBom('مصطفی');

      sut.edit(sut.orderNumber(), sut.trackingNumber(), sut.description(), [
        ...sut.components(),
      ]);

      expect(sut.approvalStatus()).toBe(ApprovalStatus.Approved);
      expect(sut.approvedBy()).toBe('مصطفی');
      expect(sut.releaseEvents()).toEqual([]);
    });

    it('editing an unapproved BOM records no approval lines', () => {
      const sut = registerBom();
      sut.releaseEvents();

      sut.edit(
        sut.orderNumber(),
        TrackingNumber.fromString('TN-0000'),
        sut.description(),
      );

      const [event] = sut.releaseEvents() as BomEdited[];
      expect(event.changes.map((change) => change.field)).toEqual([
        'trackingNumber',
      ]);
    });

    it('a rejected edit leaves an approved BOM approved by the same approver', () => {
      const sut = approvedBom('مصطفی');

      expect(() =>
        sut.edit(
          OrderNumber.fromString('SO-9999'),
          sut.trackingNumber(),
          sut.description(),
          [],
        ),
      ).toThrow();
      expect(sut.approvalStatus()).toBe(ApprovalStatus.Approved);
      expect(sut.approvedBy()).toBe('مصطفی');
    });
  });
});
