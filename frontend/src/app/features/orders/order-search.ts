import { matchesSearch } from '../../core/i18n/search-normalizer';
import { AppOrder } from '../../core/orders/orders-gateway';

/** A product an order's MI codes belong to. */
export interface OrderProduct {
  readonly id: string;
  readonly name: string;
}

/** Each product of the order once, in the order its codes were assigned. */
export function orderProducts(order: AppOrder): OrderProduct[] {
  const products = new Map<string, OrderProduct>();
  for (const code of order.miCodes) {
    if (!products.has(code.productId)) {
      products.set(code.productId, { id: code.productId, name: code.productName });
    }
  }
  return [...products.values()];
}

/**
 * The «سفارشات» list's one search box (issue #114), applied in the browser over the whole list the
 * page already holds: an order is found by a case-insensitive substring of its number or of any of
 * its product names — exactly what the list's two text columns show. `matchesSearch` folds Persian
 * and Arabic-Indic digits (and the Arabic letter forms) on both sides, so «۵۰۰۱» finds «ORD-5001».
 * A blank search keeps every order.
 */
export function searchOrders(orders: readonly AppOrder[], query: string): AppOrder[] {
  return orders.filter((order) =>
    [order.orderNumber, ...order.miCodes.map((code) => code.productName)].some((text) =>
      matchesSearch(text, query),
    ),
  );
}
