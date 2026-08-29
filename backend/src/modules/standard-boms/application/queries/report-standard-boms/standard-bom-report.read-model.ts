/**
 * A flat, list-oriented projection of a Standard BOM used by the "مشاهده
 * آنالیز استاندارد" report (`/standard-boms/report`). Intentionally does NOT
 * include the full component/material composition — that lives behind the
 * detail dialog and would be wasteful to clone for every list row. Fields
 * the list renders (کد MI, نام محصول, برند, فعال) plus the sort/filter
 * identity (`id`) are enough.
 */
export class StandardBomReportItem {
  constructor(
    public readonly id: string,
    public readonly miCode: string,
    public readonly brand: string,
    public readonly productName: string,
    public readonly active: boolean,
  ) {}
}

export class StandardBomReportPage {
  constructor(
    public readonly items: StandardBomReportItem[],
    public readonly total: number,
  ) {}
}
