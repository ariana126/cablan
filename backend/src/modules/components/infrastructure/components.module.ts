import { CommandHandlers } from '@components/application/commands';
import { QueryHandlers } from '@components/application/queries';
import { ComponentRepository } from '@components/domain/service/component.repository';
import { Controllers } from '@components/infrastructure/http/controllers';
import { Module } from '@nestjs/common';

import { PrismaComponentRepository } from './persistence/component.repository';

@Module({
  controllers: [...Controllers],
  providers: [
    ...CommandHandlers,
    ...QueryHandlers,
    { provide: ComponentRepository, useClass: PrismaComponentRepository },
  ],
})
export class ComponentsModule {}
