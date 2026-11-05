import { Identity } from '@framework/domain';

import { OrderDefined } from './events/order-defined.event';
import { OrderDeleted } from './events/order-deleted.event';
import { OrderEdited } from './events/order-edited.event';
import { OrderMiCodeAdded } from './events/order-mi-code-added.event';
import { BomMiCodeNotInOrder } from './exceptions/bom-mi-code-not-in-order.exception';
import { BomMiCodeRequired } from './exceptions/bom-mi-code-required.exception';
import { OrderMiCodeAlreadyAssigned } from './exceptions/order-mi-code-already-assigned.exception';
import { Order } from './order.aggregate';
import { OrderMiCode } from './value/order-mi-code.vo';
import { OrderNumber } from './value/order-number.vo';

const CABLE_25 = Identity.fromString('product-cable-2.5');
const CABLE_4 = Identity.fromString('product-cable-4');

function miCode(
  code: string,
  product: Identity = CABLE_25,
  productName = 'کابل 2.5',
): OrderMiCode {
  return OrderMiCode.of(
    Identity.fromString(`standard-bom-${code}`),
    code,
    product,
    productName,
  );
}

// What `act` throws — `toThrow()` cannot take an exception class whose
// constructor is private.
function errorThrownBy(act: () => unknown): unknown {
  try {
    act();
  } catch (error) {
    return error;
  }
  return undefined;
}

function standardBomOf(code: string): Identity {
  return Identity.fromString(`standard-bom-${code}`);
}

function definedOrder(...codes: OrderMiCode[]): Order {
  const order = Order.define(OrderNumber.fromString('ORD-5001'), codes);
  order.releaseEvents();
  return order;
}

describe('Order', () => {
  describe('define', () => {
    it('defines an order with its number and MI codes, in the order given', () => {
      const order = Order.define(OrderNumber.fromString('ORD-۵۰۰۱'), [
        miCode('1001'),
        miCode('2001', CABLE_4, 'کابل 4'),
      ]);

      expect(order.orderNumber().asString()).toBe('ORD-5001');
      expect(order.miCodes().map((code) => code.miCode())).toEqual([
        '1001',
        '2001',
      ]);
      expect(order.releaseEvents()).toEqual([
        new OrderDefined(order.id.asString(), {
          orderNumber: 'ORD-5001',
          miCodes: [
            { miCode: '1001', productName: 'کابل 2.5' },
            { miCode: '2001', productName: 'کابل 4' },
          ],
        }),
      ]);
    });

    it('refuses an order with no MI code', () => {
      expect(() =>
        Order.define(OrderNumber.fromString('ORD-5001'), []),
      ).toThrow('An order must have at least one MI code');
    });

    it('refuses the same standard BOM twice', () => {
      expect(() =>
        Order.define(OrderNumber.fromString('ORD-5001'), [
          miCode('1001'),
          miCode('1001'),
        ]),
      ).toThrow(OrderMiCodeAlreadyAssigned);
    });
  });

  describe('addMiCode', () => {
    it('adds an MI code after the ones it has', () => {
      const order = definedOrder(miCode('1001'));

      order.addMiCode(miCode('1002'));

      expect(order.miCodes().map((code) => code.miCode())).toEqual([
        '1001',
        '1002',
      ]);
      expect(order.releaseEvents()).toEqual([
        new OrderMiCodeAdded(
          order.id.asString(),
          'ORD-5001',
          '1002',
          'کابل 2.5',
        ),
      ]);
    });

    it('refuses an MI code the order already has, recording nothing', () => {
      const order = definedOrder(miCode('1001'));

      expect(() => order.addMiCode(miCode('1001'))).toThrow(
        OrderMiCodeAlreadyAssigned,
      );
      expect(order.miCodes()).toHaveLength(1);
      expect(order.releaseEvents()).toEqual([]);
    });
  });

  describe('edit', () => {
    it('renumbers the order and replaces its MI codes, recording each change', () => {
      const order = definedOrder(miCode('1001'), miCode('1002'));

      order.edit(OrderNumber.fromString('ORD-7002'), [miCode('1001')]);

      expect(order.orderNumber().asString()).toBe('ORD-7002');
      expect(order.miCodes().map((code) => code.miCode())).toEqual(['1001']);
      expect(order.releaseEvents()).toEqual([
        new OrderEdited(order.id.asString(), 'ORD-7002', [
          {
            field: 'orderNumber',
            previousValue: 'ORD-5001',
            newValue: 'ORD-7002',
          },
          {
            field: 'miCodes',
            previousValue: '1001, 1002',
            newValue: '1001',
          },
        ]),
      ]);
    });

    it('keeps its MI codes, and records no MI-code change, when they are resent as the same set in another order', () => {
      const first = miCode('1001');
      const second = miCode('1002');
      const order = definedOrder(first, second);

      order.edit(OrderNumber.fromString('ORD-5010'), [
        miCode('1002'),
        miCode('1001'),
      ]);

      expect(order.miCodes()).toEqual([first, second]);
      expect(order.releaseEvents()).toEqual([
        new OrderEdited(order.id.asString(), 'ORD-5010', [
          {
            field: 'orderNumber',
            previousValue: 'ORD-5001',
            newValue: 'ORD-5010',
          },
        ]),
      ]);
    });

    it('records nothing when nothing changes', () => {
      const order = definedOrder(miCode('1001'));

      order.edit(OrderNumber.fromString('ORD-5001'), [miCode('1001')]);

      expect(order.releaseEvents()).toEqual([]);
    });

    it('refuses an edit leaving no MI code, or one twice, changing nothing', () => {
      const order = definedOrder(miCode('1001'));

      expect(() => order.edit(OrderNumber.fromString('ORD-7'), [])).toThrow(
        'An order must have at least one MI code',
      );
      expect(() =>
        order.edit(OrderNumber.fromString('ORD-7'), [
          miCode('1002'),
          miCode('1002'),
        ]),
      ).toThrow(OrderMiCodeAlreadyAssigned);
      expect(order.orderNumber().asString()).toBe('ORD-5001');
      expect(order.releaseEvents()).toEqual([]);
    });
  });

  describe('changesOnlyCorrectableFields', () => {
    const order = definedOrder(miCode('1001'), miCode('1002'));

    it('is true when the MI codes are left as they are, or resent as the same set of standard BOMs', () => {
      expect(order.changesOnlyCorrectableFields()).toBe(true);
      expect(
        order.changesOnlyCorrectableFields([miCode('1002'), miCode('1001')]),
      ).toBe(true);
    });

    it('is false when one of its MI codes is given twice in place of another', () => {
      expect(
        order.changesOnlyCorrectableFields([miCode('1001'), miCode('1001')]),
      ).toBe(false);
    });

    it('is false when an MI code is removed or added', () => {
      expect(order.changesOnlyCorrectableFields([miCode('1001')])).toBe(false);
      expect(
        order.changesOnlyCorrectableFields([
          miCode('1001'),
          miCode('1002'),
          miCode('1003'),
        ]),
      ).toBe(false);
    });
  });

  describe('the MI code a daily BOM is registered with (issue #101)', () => {
    it('is the only one of an order that has one, when none is chosen', () => {
      expect(definedOrder(miCode('1001')).miCodeForDailyBom()?.miCode()).toBe(
        '1001',
      );
    });

    it('must be chosen among several', () => {
      const order = definedOrder(miCode('1001'), miCode('1002'));

      expect(errorThrownBy(() => order.miCodeForDailyBom())).toBeInstanceOf(
        BomMiCodeRequired,
      );
    });

    it('is the chosen one, typed with Persian digits too', () => {
      const order = definedOrder(miCode('1001'), miCode('1002'));

      expect(order.miCodeForDailyBom('۱۰۰۲').miCode()).toBe('1002');
    });

    it('must be one of the order', () => {
      const order = definedOrder(miCode('1001'));

      expect(
        errorThrownBy(() => order.miCodeForDailyBom('1003')),
      ).toBeInstanceOf(BomMiCodeNotInOrder);
    });
  });

  describe('a daily BOM moved onto the order, or to another of its MI codes (issue #101)', () => {
    const order = definedOrder(
      miCode('1001'),
      miCode('1002'),
      miCode('2001', CABLE_4, 'کابل 4'),
    );

    it('must keep to a standard BOM the order holds', () => {
      expect(() =>
        order.assertHoldsStandardBom(standardBomOf('1001'), '1001'),
      ).not.toThrow();
      expect(
        errorThrownBy(() =>
          order.assertHoldsStandardBom(standardBomOf('3001'), '3001'),
        ),
      ).toBeInstanceOf(BomMiCodeNotInOrder);
    });

    it('may move to another MI code of the same product the order holds', () => {
      expect(() =>
        order.assertPermitsRepointing(
          standardBomOf('1001'),
          standardBomOf('1002'),
          '1002',
        ),
      ).not.toThrow();
    });

    it.each([
      ['of another product', '2001'],
      ['the order does not hold', '1003'],
    ])('may not move to an MI code %s', (_why, code) => {
      expect(
        errorThrownBy(() =>
          order.assertPermitsRepointing(
            standardBomOf('1001'),
            standardBomOf(code),
            code,
          ),
        ),
      ).toBeInstanceOf(BomMiCodeNotInOrder);
    });

    it('may not move from an MI code the order does not hold, its product unknown', () => {
      expect(
        errorThrownBy(() =>
          order.assertPermitsRepointing(
            standardBomOf('1003'),
            standardBomOf('1002'),
            '1002',
          ),
        ),
      ).toBeInstanceOf(BomMiCodeNotInOrder);
    });
  });

  describe('the MI codes it assigns', () => {
    const order = definedOrder(miCode('1001'), miCode('2001', CABLE_4));

    it('finds an assigned MI code by its code, Persian digits too', () => {
      expect(order.miCodeNamed('۱۰۰۱')?.miCode()).toBe('1001');
      expect(order.miCodeNamed('3001')).toBeNull();
    });

    it('finds an assigned MI code by its standard BOM', () => {
      expect(
        order
          .miCodeOfStandardBom(Identity.fromString('standard-bom-2001'))
          ?.productId(),
      ).toEqual(CABLE_4);
      expect(
        order.miCodeOfStandardBom(Identity.fromString('standard-bom-9')),
      ).toBeNull();
    });
  });

  it('records its deletion with what it held', () => {
    const order = definedOrder(miCode('1001'));
    expect(order.isDeleted()).toBe(false);

    order.delete();

    expect(order.isDeleted()).toBe(true);

    expect(order.releaseEvents()).toEqual([
      new OrderDeleted(order.id.asString(), {
        orderNumber: 'ORD-5001',
        miCodes: [{ miCode: '1001', productName: 'کابل 2.5' }],
      }),
    ]);
  });
});
