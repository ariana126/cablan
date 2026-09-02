import { Injectable } from '@angular/core';
import { MatPaginatorIntl } from '@angular/material/paginator';

import { toPersianDigits } from '../i18n/persian-numerals';

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

  /**
   * `toPersianDigits`, not `formatPersianNumber`: these are positions in a list rather than
   * quantities, and a report with more than a thousand rows should read "۱۰۰۰" here rather than
   * "۱٬۰۰۰" beside a "تا" and an "از".
   *
   * Note the page-size dropdown beside this label keeps Latin digits. `MatPaginator` renders
   * `pageSizeOptions` through its own template with no formatting hook — `MatPaginatorIntl` does not
   * reach it — and the alternatives are a banned `::ng-deep` or hand-building a paginator.
   */
  override getRangeLabel = (page: number, pageSize: number, length: number): string => {
    if (length === 0 || pageSize === 0) {
      return toPersianDigits(`0 از ${length}`);
    }

    const startIndex = page * pageSize;
    const endIndex = Math.min(startIndex + pageSize, length);
    return toPersianDigits(`${startIndex + 1} تا ${endIndex} از ${length}`);
  };
}
