import {
  ApplyToRelatedRecords,
  CompositionOrderPropagator,
  CorrectionPropagator,
  DependentRecord,
  DependentsProbe,
  RecordCorrection,
  RecordDependencies,
  RecordReference,
} from '@framework/application';
import { Role, UserRoleProvider } from '@framework/domain';
import { Global, Injectable, Module, Scope } from '@nestjs/common';
import { DiscoveryService } from '@nestjs/core';
import { Test, TestingModule } from '@nestjs/testing';

import { DiscoveredDependentsProbes } from './discovered-dependents-probes';
import { RecordDependenciesModule } from './record-dependencies.module';

const material: RecordReference = { type: 'Material', id: 'material-1' };

@Injectable()
class ProductsProbe extends DependentsProbe {
  dependentsOf(reference: RecordReference): Promise<DependentRecord[]> {
    return Promise.resolve(
      reference.type === 'Material'
        ? [{ kind: 'product', name: 'کابل NYY' }]
        : [],
    );
  }
}

@Injectable()
class BomsProbe extends DependentsProbe {
  dependentsOf(reference: RecordReference): Promise<DependentRecord[]> {
    return Promise.resolve(
      reference.type === 'Material'
        ? [{ kind: 'daily-bom', name: 'ORD-1' }]
        : [],
    );
  }
}

@Injectable({ scope: Scope.REQUEST })
class RequestScopedProbe extends DependentsProbe {
  dependentsOf(): Promise<DependentRecord[]> {
    return Promise.resolve([]);
  }
}

// What `identity` binds in the app: the role lookup behind
// `ApplyToRelatedRecordsResolver`, which this module provides.
@Global()
@Module({
  providers: [
    {
      provide: UserRoleProvider,
      useValue: { getRole: () => Promise.resolve(Role.SystemAdmin) },
    },
  ],
  exports: [UserRoleProvider],
})
class Roles {}

// Issue #110: a module holding snapshots registers a propagator the same way.
const propagated: string[] = [];

@Injectable()
class ProductsPropagator extends CorrectionPropagator {
  propagate(
    reference: RecordReference,
    correction: RecordCorrection,
  ): Promise<void> {
    propagated.push(`products:${reference.id}:${correction.name}`);
    return Promise.resolve();
  }
}

@Injectable()
class BomsPropagator extends CorrectionPropagator {
  propagate(
    reference: RecordReference,
    correction: RecordCorrection,
  ): Promise<void> {
    propagated.push(`boms:${reference.id}:${correction.name}`);
    return Promise.resolve();
  }
}

@Module({
  imports: [RecordDependenciesModule],
  providers: [ProductsPropagator],
})
class ProductsSnapshots {}

@Module({
  imports: [RecordDependenciesModule],
  providers: [
    BomsPropagator,
    { provide: 'BomsPropagatorAlias', useExisting: BomsPropagator },
  ],
})
class BomsSnapshots {}

@Injectable({ scope: Scope.REQUEST })
class RequestScopedPropagator extends CorrectionPropagator {
  propagate(): Promise<void> {
    return Promise.resolve();
  }
}

// Issue #122: a module holding snapshots of a composition registers a
// composition order propagator the same way.
const product: RecordReference = { type: 'Product', id: 'product-1' };
const reordered: string[] = [];

@Injectable()
class StandardBomOrderPropagator extends CompositionOrderPropagator {
  propagate(
    reference: RecordReference,
    orderedComponentIds: readonly string[],
  ): Promise<void> {
    reordered.push(`standard:${reference.id}:${orderedComponentIds.join(',')}`);
    return Promise.resolve();
  }
}

@Injectable()
class DailyBomOrderPropagator extends CompositionOrderPropagator {
  propagate(
    reference: RecordReference,
    orderedComponentIds: readonly string[],
  ): Promise<void> {
    reordered.push(`daily:${reference.id}:${orderedComponentIds.join(',')}`);
    return Promise.resolve();
  }
}

@Module({
  imports: [RecordDependenciesModule],
  providers: [StandardBomOrderPropagator],
})
class StandardBomOrder {}

@Module({
  imports: [RecordDependenciesModule],
  providers: [
    DailyBomOrderPropagator,
    {
      provide: 'DailyBomOrderPropagatorAlias',
      useExisting: DailyBomOrderPropagator,
    },
  ],
})
class DailyBomOrder {}

@Injectable({ scope: Scope.REQUEST })
class RequestScopedOrderPropagator extends CompositionOrderPropagator {
  propagate(): Promise<void> {
    return Promise.resolve();
  }
}

// Two feature modules, each importing the framework module and registering
// its own probe — the shape the app has.
@Module({ imports: [RecordDependenciesModule], providers: [ProductsProbe] })
class ProductsFeature {}

@Module({
  imports: [RecordDependenciesModule],
  providers: [BomsProbe, { provide: 'BomsProbeAlias', useExisting: BomsProbe }],
})
class BomsFeature {}

// A second module providing the same probe class gets its own instance.
@Module({ imports: [RecordDependenciesModule], providers: [ProductsProbe] })
class AnotherProductsFeature {}

describe('RecordDependenciesModule', () => {
  let moduleRef: TestingModule | undefined;

  afterEach(async () => {
    await moduleRef?.close();
    moduleRef = undefined;
  });

  it("asks every module's probe, each once, whichever module imported it", async () => {
    moduleRef = await Test.createTestingModule({
      imports: [Roles, ProductsFeature, BomsFeature],
    }).compile();
    await moduleRef.init();

    const dependencies = moduleRef.get(RecordDependencies);

    expect(await dependencies.dependentsOf(material)).toEqual([
      { kind: 'product', count: 1, names: ['کابل NYY'] },
      { kind: 'daily-bom', count: 1, names: ['ORD-1'] },
    ]);
  });

  it('asks one probe class once, even when two modules provide it', async () => {
    moduleRef = await Test.createTestingModule({
      imports: [Roles, ProductsFeature, AnotherProductsFeature],
    }).compile();
    await moduleRef.init();

    const dependencies = moduleRef.get(RecordDependencies);

    expect(await dependencies.dependentsOf(material)).toEqual([
      { kind: 'product', count: 1, names: ['کابل NYY'] },
    ]);
  });

  it("hands a correction to every module's propagator, each once", async () => {
    propagated.length = 0;
    moduleRef = await Test.createTestingModule({
      imports: [Roles, ProductsSnapshots, BomsSnapshots],
    }).compile();
    await moduleRef.init();

    await moduleRef.get(RecordDependencies).editRecordInUse(
      material,
      {
        applyToRelatedRecords: ApplyToRelatedRecords.askedBy(
          Role.SystemAdmin,
          true,
        ),
        changesOnlyCorrectableFields: true,
        before: { name: 'Copper' },
        after: { name: 'مس' },
      },
      () => Promise.resolve(),
    );

    expect(propagated.toSorted((a, b) => a.localeCompare(b))).toEqual([
      'boms:material-1:مس',
      'products:material-1:مس',
    ]);
  });

  it("hands a reordering to every module's composition order propagator, each once", async () => {
    reordered.length = 0;
    moduleRef = await Test.createTestingModule({
      imports: [Roles, StandardBomOrder, DailyBomOrder],
    }).compile();
    await moduleRef.init();

    await moduleRef.get(RecordDependencies).editRecordInUse(
      product,
      {
        applyToRelatedRecords: ApplyToRelatedRecords.notAsked(),
        changesOnlyCorrectableFields: true,
        before: { name: 'کابل' },
        after: { name: 'کابل' },
        reorderedComposition: ['sheath', 'conductor'],
      },
      () => Promise.resolve(),
    );

    expect(reordered.toSorted((a, b) => a.localeCompare(b))).toEqual([
      'daily:product-1:sheath,conductor',
      'standard:product-1:sheath,conductor',
    ]);
  });

  it('fails module init on a composition order propagator that is not a singleton', async () => {
    const compiled = await Test.createTestingModule({
      imports: [Roles, RecordDependenciesModule],
      providers: [RequestScopedOrderPropagator],
    }).compile();

    await expect(compiled.init()).rejects.toThrow(
      /RequestScopedOrderPropagator .*not a static singleton/,
    );
  });

  it('fails module init on a propagator that is not a singleton', async () => {
    const compiled = await Test.createTestingModule({
      imports: [Roles, RecordDependenciesModule],
      providers: [RequestScopedPropagator],
    }).compile();

    await expect(compiled.init()).rejects.toThrow(
      /RequestScopedPropagator .*not a static singleton/,
    );
  });

  it('refuses to be read before module init has found the probes', () => {
    const probes = new DiscoveredDependentsProbes({
      getProviders: () => [],
    } as unknown as DiscoveryService);

    expect(() => [...probes]).toThrow(/before module init/);
  });

  it('fails module init on a probe that is not a singleton', async () => {
    const compiled = await Test.createTestingModule({
      imports: [Roles, RecordDependenciesModule],
      providers: [RequestScopedProbe],
    }).compile();

    await expect(compiled.init()).rejects.toThrow(
      /RequestScopedProbe .*not a static singleton/,
    );
  });
});
