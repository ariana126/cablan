import { OnModuleInit } from '@nestjs/common';
import { DiscoveryService } from '@nestjs/core';

// The class every provider of one kind extends — `DependentsProbe`,
// `CorrectionPropagator` — as a value whose prototype `instanceof` can test.
type PortClass<T> = abstract new (...args: never[]) => T;

/**
 * Every provider in the application whose class extends one port, found once
 * when the module initialises — by then Nest has created every static
 * provider. Listing such a provider in its module's `providers` is the whole
 * registration, so `framework/` never names a feature module.
 *
 * It fails closed. Read before module init, it throws rather than answer
 * "none", which would let a referenced record be edited or deleted, or a
 * correction skip its snapshots. A provider must be a static singleton: one
 * that is request-scoped or transient (or depends on such a provider) has no
 * instance here, so module init fails naming it rather than skip it. Each
 * class is asked once — a provider bound again with `useExisting`, or the
 * same class provided by two modules, would otherwise answer twice.
 */
export abstract class DiscoveredProviders<T extends object>
  implements Iterable<T>, OnModuleInit
{
  private found: readonly T[] | null = null;

  protected constructor(
    private readonly discovery: DiscoveryService,
    private readonly port: PortClass<T>,
    private readonly portName: string,
  ) {}

  onModuleInit(): void {
    const byClass = new Map<unknown, T>();
    for (const wrapper of this.discovery.getProviders()) {
      const metatype = wrapper.metatype as { prototype?: unknown } | null;
      const instance: unknown = wrapper.instance;
      const declares = metatype?.prototype instanceof this.port;
      if (!declares && !(instance instanceof this.port)) {
        continue;
      }
      if (
        !(instance instanceof this.port) ||
        wrapper.isTransient ||
        !wrapper.isDependencyTreeStatic()
      ) {
        throw new Error(
          `${wrapper.name} is a ${this.portName} but not a static singleton ` +
            '(it is request-scoped or transient, or depends on such a provider). ' +
            `${this.portName}s must be singletons.`,
        );
      }
      // A `useExisting` alias has a factory metatype, so key by the
      // instance's own class: that dedupes the alias and a second module's
      // instance of the same class alike.
      byClass.set(instance.constructor, instance);
    }
    this.found = [...byClass.values()];
  }

  [Symbol.iterator](): Iterator<T> {
    if (this.found === null) {
      throw new Error(
        `The ${this.portName}s were read before module init found them; ` +
          'refusing to answer as if there were none.',
      );
    }
    return this.found[Symbol.iterator]();
  }
}
