import {
  DependentRecord,
  DependentsProbe,
  RecordDependencies,
  RecordReference,
} from '@framework/application';
import { Injectable, Module, Scope } from '@nestjs/common';
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
      imports: [ProductsFeature, BomsFeature],
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
      imports: [ProductsFeature, AnotherProductsFeature],
    }).compile();
    await moduleRef.init();

    const dependencies = moduleRef.get(RecordDependencies);

    expect(await dependencies.dependentsOf(material)).toEqual([
      { kind: 'product', count: 1, names: ['کابل NYY'] },
    ]);
  });

  it('refuses to be read before module init has found the probes', () => {
    const probes = new DiscoveredDependentsProbes({
      getProviders: () => [],
    } as unknown as DiscoveryService);

    expect(() => [...probes]).toThrow(/before module init/);
  });

  it('fails module init on a probe that is not a singleton', async () => {
    const compiled = await Test.createTestingModule({
      imports: [RecordDependenciesModule],
      providers: [RequestScopedProbe],
    }).compile();

    await expect(compiled.init()).rejects.toThrow(
      /RequestScopedProbe .*not a static singleton/,
    );
  });
});
