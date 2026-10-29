import { Module } from '@nestjs/common';
import { CommandHandlers } from '@products/application/commands';
import { QueryHandlers } from '@products/application/queries';
import { MaterialImportSheetReader } from '@products/application/service/material-import-sheet-reader';
import { ProductCompositionFactory } from '@products/application/service/product-composition.factory';
import { ComponentRepository } from '@products/domain/service/component.repository';
import { MaterialRepository } from '@products/domain/service/material.repository';
import { MaterialImportRepository } from '@products/domain/service/material-import.repository';
import { MaterialImportReversion } from '@products/domain/service/material-import-reversion';
import { ProductRepository } from '@products/domain/service/product.repository';
import { Controllers } from '@products/infrastructure/http/controllers';

import { PrismaComponentRepository } from './persistence/component.repository';
import { PrismaMaterialRepository } from './persistence/material.repository';
import { PrismaMaterialImportRepository } from './persistence/material-import.repository';
import { PrismaProductRepository } from './persistence/product.repository';
import { XlsxMaterialImportSheetReader } from './spreadsheet/xlsx-material-import-sheet-reader';

@Module({
  controllers: [...Controllers],
  providers: [
    ...CommandHandlers,
    ...QueryHandlers,
    ProductCompositionFactory,
    { provide: MaterialRepository, useClass: PrismaMaterialRepository },
    { provide: ComponentRepository, useClass: PrismaComponentRepository },
    { provide: ProductRepository, useClass: PrismaProductRepository },
    {
      provide: MaterialImportRepository,
      useClass: PrismaMaterialImportRepository,
    },
    {
      provide: MaterialImportSheetReader,
      useClass: XlsxMaterialImportSheetReader,
    },
    // A domain service carries no Nest decorator, so it is built here.
    {
      provide: MaterialImportReversion,
      useFactory: (
        materialImports: MaterialImportRepository,
        materials: MaterialRepository,
        products: ProductRepository,
      ) => new MaterialImportReversion(materialImports, materials, products),
      inject: [MaterialImportRepository, MaterialRepository, ProductRepository],
    },
  ],
})
export class ProductsModule {}
