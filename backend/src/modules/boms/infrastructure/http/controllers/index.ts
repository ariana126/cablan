import { BomController } from '@boms/infrastructure/http/controllers/bom/bom.controller';
import { BomDashboardController } from '@boms/infrastructure/http/controllers/bom-dashboard/bom-dashboard.controller';
import { OrderController } from '@boms/infrastructure/http/controllers/order/order.controller';

export const Controllers = [
  BomController,
  BomDashboardController,
  OrderController,
];
