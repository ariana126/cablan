import { GetProductHandler } from '@products/application/queries/get-product/get-product.handler';
import { ListProductsHandler } from '@products/application/queries/list-products/list-products.handler';

export const QueryHandlers = [ListProductsHandler, GetProductHandler];
