import { HttpErrorResponse } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { catchError, map, Observable, of, throwError } from 'rxjs';

import { DefineOrderDto, OrderControllerGet200, UpdateOrderDto } from '../../api/model';
import { OrdersService } from '../../api/orders/orders.service';
import { toLatinDigits } from '../i18n/persian-numerals';

/** One MI code assigned to an order: the standard BOM it names, and that BOM's product. */
export interface AppOrderMiCode {
  readonly standardBomId: string;
  readonly miCode: string;
  readonly productId: string;
  readonly productName: string;
}

/** An order (issue #101) — every field always present, unlike the generated response item. */
export interface AppOrder {
  readonly id: string;
  readonly orderNumber: string;
  /** In assignment order. */
  readonly miCodes: readonly AppOrderMiCode[];
  /** How many daily BOMs are registered for it — an order with any is in use. */
  readonly dailyBomCount: number;
}

function toAppOrder(item: OrderControllerGet200): AppOrder {
  return {
    id: item.id ?? '',
    orderNumber: item.orderNumber ?? '',
    miCodes: (item.miCodes ?? []).map((code) => ({
      standardBomId: code.standardBomId ?? '',
      miCode: code.miCode ?? '',
      productId: code.productId ?? '',
      productName: code.productName ?? '',
    })),
    dailyBomCount: item.dailyBomCount ?? 0,
  };
}

/**
 * Orders and the MI codes assigned to them. Every production role reads them (the daily-BOM form
 * looks an order up as its number is typed); only Management and the System Admin write — the API
 * answers 403 for anyone else.
 */
@Injectable({ providedIn: 'root' })
export class OrdersGateway {
  private readonly api = inject(OrdersService);

  list(): Observable<AppOrder[]> {
    return this.api.orderControllerList().pipe(map((list) => (list.items ?? []).map(toAppOrder)));
  }

  /**
   * The order with this number, or `null` when there is none. The number is trimmed and its digits
   * made Latin first — an identifier the visitor typed, sent as the API stores it — and it travels
   * as one path segment whatever it holds.
   */
  findByNumber(orderNumber: string): Observable<AppOrder | null> {
    const segment = encodeURIComponent(toLatinDigits(orderNumber.trim()));
    return this.api.orderControllerGetByNumber(segment).pipe(
      map(toAppOrder),
      catchError((error: unknown) =>
        error instanceof HttpErrorResponse && error.status === 404
          ? of(null)
          : throwError(() => error),
      ),
    );
  }

  define(order: DefineOrderDto): Observable<void> {
    return this.api.orderControllerDefine(order).pipe(map(() => undefined));
  }

  addMiCode(id: string, miCode: string): Observable<void> {
    return this.api.orderControllerAddMiCode(id, { miCode });
  }

  update(id: string, changes: UpdateOrderDto): Observable<void> {
    return this.api.orderControllerUpdate(id, changes);
  }

  delete(id: string): Observable<void> {
    return this.api.orderControllerDelete(id);
  }
}
