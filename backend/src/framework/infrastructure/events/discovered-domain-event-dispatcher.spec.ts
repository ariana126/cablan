import {
  DomainEventDispatcher,
  DomainEventHandler,
  DomainEventHandlerOf,
} from '@framework/application';
import { Injectable, Provider, Scope } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';

import { DomainEventsModule } from './domain-events.module';

class Shipped {
  constructor(public readonly id: string) {}
}

class Cancelled {
  constructor(public readonly id: string) {}
}

class NobodyListens {}

@Injectable()
class Journal {
  readonly lines: string[] = [];
}

@DomainEventHandler(Shipped)
class SlowShippedHandler implements DomainEventHandlerOf<Shipped> {
  constructor(private readonly journal: Journal) {}

  async handle(event: Shipped): Promise<void> {
    this.journal.lines.push(`slow started ${event.id}`);
    await new Promise<void>((resolve) => setTimeout(resolve, 10));
    this.journal.lines.push(`slow finished ${event.id}`);
  }
}

@DomainEventHandler(Shipped)
class FastShippedHandler implements DomainEventHandlerOf<Shipped> {
  constructor(private readonly journal: Journal) {}

  handle(event: Shipped): Promise<void> {
    this.journal.lines.push(`fast ${event.id}`);
    return Promise.resolve();
  }
}

@DomainEventHandler(Cancelled)
class CancelledHandler implements DomainEventHandlerOf<Cancelled> {
  constructor(private readonly journal: Journal) {}

  handle(event: Cancelled): Promise<void> {
    this.journal.lines.push(`cancelled ${event.id}`);
    return Promise.resolve();
  }
}

@DomainEventHandler(Shipped)
class FailingShippedHandler implements DomainEventHandlerOf<Shipped> {
  handle(): Promise<void> {
    return Promise.reject(new Error('handler failed'));
  }
}

describe('DiscoveredDomainEventDispatcher', () => {
  let moduleRef: TestingModule | undefined;

  function moduleWith(handlers: Provider[]): Promise<TestingModule> {
    return Test.createTestingModule({
      imports: [DomainEventsModule],
      providers: [Journal, ...handlers],
    }).compile();
  }

  async function dispatcherWith(handlers: Provider[]) {
    const compiled = await moduleWith(handlers);
    moduleRef = compiled;
    await compiled.init();
    return {
      dispatcher: compiled.get(DomainEventDispatcher),
      journal: compiled.get(Journal),
    };
  }

  afterEach(async () => {
    await moduleRef?.close();
    moduleRef = undefined;
  });

  it('runs every handler registered for an event class, and only those', async () => {
    const { dispatcher, journal } = await dispatcherWith([
      SlowShippedHandler,
      FastShippedHandler,
      CancelledHandler,
    ]);

    await dispatcher.dispatch([new Shipped('1')]);

    expect(journal.lines).toEqual([
      'slow started 1',
      'slow finished 1',
      'fast 1',
    ]);
  });

  it('runs handlers one at a time, in event order and then registration order', async () => {
    const { dispatcher, journal } = await dispatcherWith([
      SlowShippedHandler,
      FastShippedHandler,
      CancelledHandler,
    ]);

    await dispatcher.dispatch([
      new Shipped('1'),
      new Cancelled('2'),
      new Shipped('3'),
    ]);

    expect(journal.lines).toEqual([
      'slow started 1',
      'slow finished 1',
      'fast 1',
      'cancelled 2',
      'slow started 3',
      'slow finished 3',
      'fast 3',
    ]);
  });

  it('treats an event nobody handles as a no-op', async () => {
    const { dispatcher, journal } = await dispatcherWith([FastShippedHandler]);

    await expect(
      dispatcher.dispatch([new NobodyListens()]),
    ).resolves.toBeUndefined();
    expect(journal.lines).toEqual([]);
  });

  it('propagates the first failure and runs nothing after it', async () => {
    const { dispatcher, journal } = await dispatcherWith([
      FailingShippedHandler,
      FastShippedHandler,
      CancelledHandler,
    ]);

    await expect(
      dispatcher.dispatch([new Shipped('1'), new Cancelled('2')]),
    ).rejects.toThrow('handler failed');
    expect(journal.lines).toEqual([]);
  });

  it('dispatches once to a handler that is also bound under another token', async () => {
    const { dispatcher, journal } = await dispatcherWith([
      FastShippedHandler,
      { provide: 'FAST_SHIPPED_ALIAS', useExisting: FastShippedHandler },
    ]);

    await dispatcher.dispatch([new Shipped('1')]);

    expect(journal.lines).toEqual(['fast 1']);
  });

  // Its init fails, so it is never assigned to `moduleRef`: closing a
  // context whose init rejected rethrows that rejection.
  it('refuses to start when a handler is not a static singleton', async () => {
    const sut = await moduleWith([
      {
        provide: FastShippedHandler,
        useClass: FastShippedHandler,
        scope: Scope.REQUEST,
      },
    ]);

    await expect(sut.init()).rejects.toThrow(
      /FastShippedHandler .*not a static singleton/,
    );
  });
});
