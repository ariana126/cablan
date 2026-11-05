// An order as every order read answers it (issue #101's pinned contract):
// its MI codes in assignment order, each with its standard BOM and product,
// and how many daily BOMs are registered for it.
export interface OrderMiCodeItem {
  readonly standardBomId: string;
  readonly miCode: string;
  readonly productId: string;
  readonly productName: string;
}

export interface OrderReadModel {
  readonly id: string;
  readonly orderNumber: string;
  readonly miCodes: readonly OrderMiCodeItem[];
  readonly dailyBomCount: number;
}

export interface OrderList {
  readonly items: readonly OrderReadModel[];
}
