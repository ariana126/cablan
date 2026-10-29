import { GetProductHandler } from '@products/application/queries/get-product/get-product.handler';
import { ListComponentsHandler } from '@products/application/queries/list-components/list-components.handler';
import { ListMaterialsHandler } from '@products/application/queries/list-materials/list-materials.handler';
import { ListProductsHandler } from '@products/application/queries/list-products/list-products.handler';
import { PreviewMaterialImportHandler } from '@products/application/queries/preview-material-import/preview-material-import.handler';

export const QueryHandlers = [
  // materials
  ListMaterialsHandler,
  PreviewMaterialImportHandler,
  // components
  ListComponentsHandler,
  // products
  ListProductsHandler,
  GetProductHandler,
];
