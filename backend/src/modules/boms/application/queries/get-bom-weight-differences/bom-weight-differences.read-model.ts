import { MaterialWeightDifference } from '@boms/application/queries/material-weight-difference.read-model';

// The post-registration preview of one daily BOM ("پیش‌نمایش آنالیز روزانه"):
// every material line of its composition, in composition order, measured
// against the standard BOM it was cloned from — the same per-line numbers the
// dashboard shows for that BOM.
export class BomWeightDifferences {
  constructor(public readonly lines: MaterialWeightDifference[]) {}
}
