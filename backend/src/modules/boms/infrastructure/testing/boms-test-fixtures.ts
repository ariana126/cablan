import { RegisterLegacyBomCommand } from '@boms/application/commands/register-legacy-bom/register-legacy-bom.command';
import { OrderNumber } from '@boms/domain/value/order-number.vo';
import { TrackingNumber } from '@boms/domain/value/tracking-number.vo';
import { ActorContext, DisplayNameProvider } from '@framework/domain';
import { PrismaService } from '@framework/infrastructure';
import { Injectable } from '@nestjs/common';
import { CommandBus } from '@nestjs/cqrs';

import { LegacyDailyBomDto } from './dto/legacy-daily-bom.dto';
import { orderBackfillSql } from './order-backfill';

// Who registered a legacy daily BOM sent with no bearer token.
const NO_REGISTRANT = '-';

/**
 * State no client can reach any more (issue #101), set up for an external
 * test runner: daily BOMs registered before orders existed, and the legacy
 * carry-over that turns their order numbers into orders. Mounted only at
 * `NODE_ENV=test` (`BomsTestingModule`).
 */
@Injectable()
export class BomsTestFixtures {
  constructor(
    private readonly commandBus: CommandBus,
    private readonly prisma: PrismaService,
    private readonly actorContext: ActorContext,
    private readonly displayNameProvider: DisplayNameProvider,
  ) {}

  /**
   * A daily BOM registered as before issue #101: for any order number, no
   * order consulted. Its registrant is the caller, when a bearer token says
   * who (who the audit entry is written as, too); `-` otherwise, with no
   * audit entry.
   */
  async legacyDailyBom(body: LegacyDailyBomDto): Promise<string> {
    const actor = this.actorContext.currentUserId();
    const registeredBy =
      actor === null
        ? NO_REGISTRANT
        : await this.displayNameProvider.getName(actor);
    return this.commandBus.execute(
      new RegisterLegacyBomCommand(
        body.standardBomMiCode,
        OrderNumber.fromString(body.orderNumber),
        TrackingNumber.fromString(body.trackingNumber),
        body.description,
        body.components,
        registeredBy,
      ),
    );
  }

  /** The `order_backfill` migration's SQL, run again: idempotent. */
  async backfillOrders(): Promise<void> {
    await this.prisma.$executeRawUnsafe(orderBackfillSql());
  }
}
