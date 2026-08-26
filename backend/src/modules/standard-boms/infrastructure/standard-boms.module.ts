import { Module } from '@nestjs/common';
import { CommandHandlers } from '@standard-boms/application/commands';
import { QueryHandlers } from '@standard-boms/application/queries';
import { StandardBomCompositionFactory } from '@standard-boms/application/service/standard-bom-composition.factory';
import { StandardBomRepository } from '@standard-boms/domain/service/standard-bom.repository';
import { Controllers } from '@standard-boms/infrastructure/http/controllers';

import { PrismaStandardBomRepository } from './persistence/standard-bom.repository';

@Module({
  controllers: [...Controllers],
  providers: [
    ...CommandHandlers,
    ...QueryHandlers,
    StandardBomCompositionFactory,
    {
      provide: StandardBomRepository,
      useClass: PrismaStandardBomRepository,
    },
  ],
})
export class StandardBomsModule {}
