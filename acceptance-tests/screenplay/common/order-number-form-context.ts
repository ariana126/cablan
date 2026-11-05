/**
 * Which form «شماره سفارش» belongs to in the byte-identical «اما شماره سفارش را خالی میگذارد» and
 * «پیغام خطای شماره سفارش نشان داده شود» (issue #101): registring-bom says them of the daily-BOM form,
 * registring-order of the order form («تعریف سفارش»). Both are driven through the browser; only the
 * dialog differs.
 *
 * Set explicitly by every owning step — «… اطلاعات آنالیز (روزانه) جدید … وارد میکند», «… شماره
 * شفارش آن را پاک می کند» (`daily-bom`) and «… اطلاعات سفارش جدید … وارد میکند» (`order`) — so no
 * scenario inherits another's.
 */
export type OrderNumberForm = 'daily-bom' | 'order';

let current: OrderNumberForm = 'daily-bom';

export const theOrderNumberIsTypedInto = (form: OrderNumberForm): void => {
  current = form;
};

export const theFormTheOrderNumberIsTypedInto = (): OrderNumberForm => current;
