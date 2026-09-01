import { EventHandlers } from '@audit-logging/application/event-handlers';
import { QueryHandlers } from '@audit-logging/application/queries';
import { AuditLogRepository } from '@audit-logging/application/service/audit-log.repository';
import { AuditLogProjector } from '@audit-logging/application/service/audit-log-projector.service';
import { Controllers } from '@audit-logging/infrastructure/http/controllers';
import { Module } from '@nestjs/common';

import { PrismaAuditLogRepository } from './persistence/audit-log.repository';

// A pure read-side module: no domain layer, no `CommandHandlers`, no write
// aggregate. `EventHandlers` are what makes this module do anything at
// all — see src/modules/audit-logging/CLAUDE.md.
@Module({
  controllers: [...Controllers],
  providers: [
    ...QueryHandlers,
    ...EventHandlers,
    AuditLogProjector,
    { provide: AuditLogRepository, useClass: PrismaAuditLogRepository },
  ],
})
export class AuditLoggingModule {}
