import { ComponentController } from '@products/infrastructure/http/controllers/component/component.controller';
import { MaterialController } from '@products/infrastructure/http/controllers/material/material.controller';
import { MaterialImportController } from '@products/infrastructure/http/controllers/material-import/material-import.controller';
import { ProductController } from '@products/infrastructure/http/controllers/product/product.controller';

// The order is load-bearing. Swagger emits routes, and the DTO schemas they
// reference, in controller registration order. Materials, components, products
// is the order they had as three modules, so keeping it keeps their part of
// docs/openapi.json byte-identical; the material import (issue #74) came later
// and goes last for the same reason.
export const Controllers = [
  MaterialController,
  ComponentController,
  ProductController,
  MaterialImportController,
];
