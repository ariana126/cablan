import { Injectable } from '@angular/core';
import { MatPaginatorIntl } from '@angular/material/paginator';

/**
 * `MatPaginator`'s built-in `MatPaginatorIntl` ships English labels ("Items per page:", "Next
 * page", …) with nothing here to translate them — this is a Persian-language product
 * (`../../../../CLAUDE.md`), and `bom-reports-page.ts` is the first page to reach for a paginator
 * at all. Registered once in `app.config.ts` rather than per-page, so any later paginator inherits
 * the same labels with no per-component wiring.
 */
@Injectable()
export class PersianPaginatorIntl extends MatPaginatorIntl {
  override itemsPerPageLabel = 'تعداد در هر صفحه:';
  override nextPageLabel = 'صفحه بعد';
  override previousPageLabel = 'صفحه قبل';
  override firstPageLabel = 'صفحه اول';
  override lastPageLabel = 'صفحه آخر';

  override getRangeLabel = (page: number, pageSize: number, length: number): string => {
    if (length === 0 || pageSize === 0) {
      return `0 از ${length}`;
    }

    const startIndex = page * pageSize;
    const endIndex = Math.min(startIndex + pageSize, length);
    return `${startIndex + 1} تا ${endIndex} از ${length}`;
  };
}
