import {
  BomDetailRecord,
  BomFilterOptionsRecord,
  BomReportCriteria,
  BomReportRepository,
  BomReportSearchResult,
} from '@boms/application/service/bom-report.repository';
import { Identity } from '@framework/domain';

// A hand-written fake, not a mock: from a query handler's point of view,
// `BomReportRepository` is an in-process collaborator, so tests use a real
// (if simplified) implementation that records what it was asked and returns
// a scripted response, rather than asserting call-by-call on a generic spy.
// It does not replicate `PrismaBomReportRepository`'s own filtering/
// pagination/sorting SQL — that translation is infrastructure-specific and
// is exercised by a real request against Postgres instead (see
// src/modules/boms/CLAUDE.md), never by reimplementing it here.
export class InMemoryBomReportRepository extends BomReportRepository {
  public lastSearchCriteria: BomReportCriteria | undefined;
  public lastDetailId: Identity | undefined;
  private searchResult: BomReportSearchResult = { items: [], total: 0 };
  private filterOptionsResult: BomFilterOptionsRecord = {
    brands: [],
    componentNames: [],
    standardBomMiCodes: [],
    productNames: [],
    registeredByUsers: [],
  };
  private detailById = new Map<string, BomDetailRecord>();

  respondToSearchWith(result: BomReportSearchResult): void {
    this.searchResult = result;
  }

  respondToFilterOptionsWith(result: BomFilterOptionsRecord): void {
    this.filterOptionsResult = result;
  }

  seedDetail(record: BomDetailRecord): void {
    this.detailById.set(record.id, record);
  }

  search(criteria: BomReportCriteria): Promise<BomReportSearchResult> {
    this.lastSearchCriteria = criteria;
    return Promise.resolve(this.searchResult);
  }

  filterOptions(): Promise<BomFilterOptionsRecord> {
    return Promise.resolve(this.filterOptionsResult);
  }

  findDetailById(id: Identity): Promise<BomDetailRecord | null> {
    this.lastDetailId = id;
    return Promise.resolve(this.detailById.get(id.asString()) ?? null);
  }
}
