import { DomainEvent } from '@framework/domain';
import { applyDecorators, Injectable, SetMetadata, Type } from '@nestjs/common';

export const DOMAIN_EVENT_HANDLER_METADATA = 'cablan:domain-event-handler';

/** What a `@DomainEventHandler(E)` provider implements. */
export interface DomainEventHandlerOf<E extends DomainEvent> {
  handle(event: E): Promise<void>;
}

/**
 * Subscribes a provider to one domain-event class. `DomainEventDispatcher`
 * awaits its `handle(event)` for every dispatched event whose constructor
 * is exactly `event`. Replaces `@nestjs/cqrs`' `@EventsHandler` for domain
 * events: that bus cannot be awaited and cannot fail its publisher. The
 * provider must still be listed in its module's `providers`.
 */
export function DomainEventHandler(event: Type<DomainEvent>) {
  return applyDecorators(
    Injectable(),
    SetMetadata(DOMAIN_EVENT_HANDLER_METADATA, event),
  );
}
