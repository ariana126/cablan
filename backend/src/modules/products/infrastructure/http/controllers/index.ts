import { ComponentController } from '@products/infrastructure/http/controllers/component/component.controller';
import { MaterialController } from '@products/infrastructure/http/controllers/material/material.controller';
import { ProductController } from '@products/infrastructure/http/controllers/product/product.controller';

// The order is load-bearing. Swagger emits routes, and the DTO schemas they
// reference, in controller registration order. Materials, components, products
// is the order they had as three modules, so keeping it keeps
// docs/openapi.json byte-identical.
export const Controllers = [
  MaterialController,
  ComponentController,
  ProductController,
];
