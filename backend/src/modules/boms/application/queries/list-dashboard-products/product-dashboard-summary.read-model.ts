// The daily-BOM dashboard's product-row shape ("داشبورد بررسی روزانه آنالیز
// های روزانه"): one entry per product that has at least one daily BOM in
// the queried range, with the number of daily BOMs that contributed to it.
// Sorted by productName asc — the repository enforces that order, so the
// handler does not re-sort on the way out.
export class ProductDashboardSummary {
  constructor(
    public readonly productId: string,
    public readonly productName: string,
    public readonly dailyBomCount: number,
  ) {}
}
