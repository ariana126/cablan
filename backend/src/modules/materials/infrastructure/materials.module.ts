import { CommandHandlers } from '@materials/application/commands';
import { QueryHandlers } from '@materials/application/queries';
import { MaterialRepository } from '@materials/domain/service/material.repository';
import { Controllers } from '@materials/infrastructure/http/controllers';
import { Module } from '@nestjs/common';

import { PrismaMaterialRepository } from './persistence/material.repository';

@Module({
  controllers: [...Controllers],
  providers: [
    ...CommandHandlers,
    ...QueryHandlers,
    { provide: MaterialRepository, useClass: PrismaMaterialRepository },
  ],
})
export class MaterialsModule {}
