// Where a daily BOM was edited: the daily BOMs page (`/boms`, which the
// post-registration preview's «ویرایش» also opens) or the daily review
// dashboard. A reviewer's edit from the dashboard is a review edit; every
// other edit is a correction (see `BomEditContext`). The enum values are also
// the wire values.
export enum BomEditSource {
  DailyBoms = 'dailyBoms',
  Dashboard = 'dashboard',
}
