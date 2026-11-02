import { DependentsProbe } from '@framework/application';
import { Injectable, OnModuleInit } from '@nestjs/common';
import { DiscoveryService } from '@nestjs/core';

/**
 * Every `DependentsProbe` provider in the application, found once when the
 * module initialises — by then Nest has created every static provider. A
 * provider is a probe when its class extends `DependentsProbe`; listing it in
 * its module's `providers` is the whole registration, so `framework/` never
 * names a feature module.
 *
 * It fails closed. Read before module init, it throws rather than answer
 * "no probes", which would let a referenced record be edited or deleted. A
 * probe must be a static singleton: one that is request-scoped or transient
 * (or depends on such a provider) has no instance here, so module init fails
 * naming it rather than skip it. Each probe class is asked once — a provider
 * bound again with `useExisting`, or the same class provided by two modules,
 * would otherwise count every dependent twice.
 */
@Injectable()
export class DiscoveredDependentsProbes
  implements Iterable<DependentsProbe>, OnModuleInit
{
  private probes: readonly DependentsProbe[] | null = null;

  constructor(private readonly discovery: DiscoveryService) {}

  onModuleInit(): void {
    const probesByClass = new Map<unknown, DependentsProbe>();
    for (const wrapper of this.discovery.getProviders()) {
      const metatype = wrapper.metatype as { prototype?: unknown } | null;
      const instance: unknown = wrapper.instance;
      const declaresProbe = metatype?.prototype instanceof DependentsProbe;
      if (!declaresProbe && !(instance instanceof DependentsProbe)) {
        continue;
      }
      if (
        !(instance instanceof DependentsProbe) ||
        wrapper.isTransient ||
        !wrapper.isDependencyTreeStatic()
      ) {
        throw new Error(
          `${wrapper.name} is a DependentsProbe but not a static singleton ` +
            '(it is request-scoped or transient, or depends on such a provider). ' +
            'Dependents probes must be singletons.',
        );
      }
      // A `useExisting` alias has a factory metatype, so key by the
      // instance's own class: that dedupes the alias and a second module's
      // instance of the same class alike.
      probesByClass.set(instance.constructor, instance);
    }
    this.probes = [...probesByClass.values()];
  }

  [Symbol.iterator](): Iterator<DependentsProbe> {
    if (this.probes === null) {
      throw new Error(
        'The dependents probes were read before module init found them; ' +
          'refusing to answer "no dependents" for a record.',
      );
    }
    return this.probes[Symbol.iterator]();
  }
}
