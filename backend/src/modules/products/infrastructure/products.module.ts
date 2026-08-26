import { Module } from '@nestjs/common';
import { CommandHandlers } from '@products/application/commands';
import { QueryHandlers } from '@products/application/queries';
import { ProductCompositionFactory } from '@products/application/service/product-composition.factory';
import { ProductRepository } from '@products/domain/service/product.repository';
import { Controllers } from '@products/infrastructure/http/controllers';

import { PrismaProductRepository } from './persistence/product.repository';

@Module({
  controllers: [...Controllers],
  providers: [
    ...CommandHandlers,
    ...QueryHandlers,
    ProductCompositionFactory,
    { provide: ProductRepository, useClass: PrismaProductRepository },
  ],
})
export class ProductsModule {}
