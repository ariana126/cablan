import { matchesSearch } from '../../core/i18n/search-normalizer';
import { AppOrder } from '../../core/orders/orders-gateway';

/** A product an order's MI codes belong to. */
export interface OrderProduct {
  readonly id: string;
  readonly name: string;
}

/** «آنالیز روزانه»: every order, only those with daily BOMs, or only those without. */
export type DailyBomFilter = 'all' | 'with' | 'without';

/**
 * The «سفارشات» list's search and filters (issue #111), applied in the browser over the whole list
 * the page already holds, and combined with AND. `productId` `''` is «همه محصولات».
 */
export interface OrderFilters {
  readonly query: string;
  readonly productId: string;
  readonly dailyBoms: DailyBomFilter;
}

export const NO_ORDER_FILTERS: OrderFilters = { query: '', productId: '', dailyBoms: 'all' };

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

/** What «محصول» offers: every product of every order once, by name. */
export function productOptions(orders: readonly AppOrder[]): OrderProduct[] {
  const products = new Map<string, OrderProduct>();
  for (const product of orders.flatMap(orderProducts)) {
    products.set(product.id, product);
  }
  return [...products.values()].sort((a, b) => a.name.localeCompare(b.name, 'fa'));
}

/**
 * Whether the search finds the order: a case-insensitive substring of its number, of one of its MI
 * codes or of one of its product names. `matchesSearch` folds Persian and Arabic-Indic digits (and
 * the Arabic letter forms) on both sides, so «۵۰۰۱» finds «ORD-5001».
 */
function matchesQuery(order: AppOrder, query: string): boolean {
  return [
    order.orderNumber,
    ...order.miCodes.flatMap((code) => [code.miCode, code.productName]),
  ].some((text) => matchesSearch(text, query));
}

function matchesDailyBoms(order: AppOrder, filter: DailyBomFilter): boolean {
  switch (filter) {
    case 'with':
      return order.dailyBomCount > 0;
    case 'without':
      return order.dailyBomCount === 0;
    default:
      return true;
  }
}

/** The orders the search and both filters let through, in the list's own order. */
export function filterOrders(orders: readonly AppOrder[], filters: OrderFilters): AppOrder[] {
  return orders.filter(
    (order) =>
      matchesQuery(order, filters.query) &&
      (filters.productId === '' ||
        order.miCodes.some((code) => code.productId === filters.productId)) &&
      matchesDailyBoms(order, filters.dailyBoms),
  );
}

/** Whether anything narrows the list — a search of only spaces does not. */
export function hasActiveFilters(filters: OrderFilters): boolean {
  return filters.query.trim() !== '' || filters.productId !== '' || filters.dailyBoms !== 'all';
}
