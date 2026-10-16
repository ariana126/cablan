import {
  DOMAIN_EVENT_HANDLER_METADATA,
  DomainEventDispatcher,
  DomainEventHandlerOf,
} from '@framework/application';
import { DomainEvent } from '@framework/domain';
import { Injectable, OnModuleInit, Type } from '@nestjs/common';
import { DiscoveryService, Reflector } from '@nestjs/core';

/**
 * Finds every `@DomainEventHandler` provider once, when the module
 * initialises. By then Nest has created every static provider. It then
 * awaits them per event, one at a time.
 *
 * A handler must be a static singleton. One that is request-scoped or
 * transient (or depends on such a provider) has no instance here, so
 * rather than skip it silently, and let its events go unhandled, module
 * init fails naming it. A provider bound a second time with `useExisting`
 * is a factory wrapper whose metatype carries no handler metadata, so it
 * is never registered twice.
 */
@Injectable()
export class DiscoveredDomainEventDispatcher
  extends DomainEventDispatcher
  implements OnModuleInit
{
  private readonly handlersByEvent = new Map<
    unknown,
    DomainEventHandlerOf<DomainEvent>[]
  >();

  constructor(
    private readonly discovery: DiscoveryService,
    private readonly reflector: Reflector,
  ) {
    super();
  }

  onModuleInit(): void {
    for (const wrapper of this.discovery.getProviders()) {
      const metatype = wrapper.metatype;
      if (!metatype) {
        continue;
      }
      const eventType = this.reflector.get<Type<DomainEvent> | undefined>(
        DOMAIN_EVENT_HANDLER_METADATA,
        metatype,
      );
      if (eventType === undefined) {
        continue;
      }
      const instance: unknown = wrapper.instance;
      if (
        !instance ||
        wrapper.isTransient ||
        !wrapper.isDependencyTreeStatic()
      ) {
        throw new Error(
          `${wrapper.name} is a @DomainEventHandler but not a static singleton ` +
            '(it is request-scoped or transient, or depends on such a provider). ' +
            'Domain event handlers must be singletons.',
        );
      }
      const handlers = this.handlersByEvent.get(eventType) ?? [];
      handlers.push(instance as DomainEventHandlerOf<DomainEvent>);
      this.handlersByEvent.set(eventType, handlers);
    }
  }

  async dispatch(events: readonly DomainEvent[]): Promise<void> {
    for (const event of events) {
      for (const handler of this.handlersByEvent.get(event.constructor) ?? []) {
        await handler.handle(event);
      }
    }
  }
}
