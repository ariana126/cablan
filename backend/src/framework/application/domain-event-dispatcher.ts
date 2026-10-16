import { DomainEvent } from '@framework/domain';

/**
 * Delivers an aggregate's released domain events to every subscriber, and
 * resolves only once they have all finished. `PrismaEntityRepository`
 * calls it inside the aggregate write's transaction, so a subscriber's
 * failure rolls the write back (ADR 0007). Events go out in order, and
 * each event's handlers run one at a time, so one transaction client is
 * never used concurrently. An event with no handler is a no-op, and the
 * first error propagates.
 */
export abstract class DomainEventDispatcher {
  abstract dispatch(events: readonly DomainEvent[]): Promise<void>;
}
