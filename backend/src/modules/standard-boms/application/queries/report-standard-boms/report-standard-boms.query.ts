export class ReportStandardBomsQuery {
  constructor(
    /** Zero-based page index. */
    public readonly page: number,
    /** Number of items per page. */
    public readonly pageSize: number,
    /** Free-text search across all fields. */
    public readonly search?: string,
    /** Filter by these brands. Empty array means no filter. */
    public readonly brands?: string[],
    /** Filter by active status. Empty array means no filter. */
    public readonly activeStatuses?: boolean[],
    /** Filter by product name. Empty array means no filter. */
    public readonly productNames?: string[],
    /** Filter by component name. Empty array means no filter. */
    public readonly componentNames?: string[],
    /** Sort field. */
    public readonly sortBy?: 'productName',
    /** Sort direction. */
    public readonly sortDir?: 'asc' | 'desc',
  ) {}
}
