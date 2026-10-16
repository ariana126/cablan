import { Module } from '@nestjs/common';
import { CommandHandlers } from '@products/application/commands';
import { QueryHandlers } from '@products/application/queries';
import { ProductCompositionFactory } from '@products/application/service/product-composition.factory';
import { ComponentRepository } from '@products/domain/service/component.repository';
import { MaterialRepository } from '@products/domain/service/material.repository';
import { ProductRepository } from '@products/domain/service/product.repository';
import { Controllers } from '@products/infrastructure/http/controllers';

import { PrismaComponentRepository } from './persistence/component.repository';
import { PrismaMaterialRepository } from './persistence/material.repository';
import { PrismaProductRepository } from './persistence/product.repository';

@Module({
  controllers: [...Controllers],
  providers: [
    ...CommandHandlers,
    ...QueryHandlers,
    ProductCompositionFactory,
    { provide: MaterialRepository, useClass: PrismaMaterialRepository },
    { provide: ComponentRepository, useClass: PrismaComponentRepository },
    { provide: ProductRepository, useClass: PrismaProductRepository },
  ],
})
export class ProductsModule {}
