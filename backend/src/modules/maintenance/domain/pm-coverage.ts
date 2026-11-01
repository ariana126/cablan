import { Equipment } from './equipment.aggregate';
import { wholePercent } from './value/whole-percent';

/**
 * How much of the equipment in service has a PM plan (`Equipment.hasPmPlan`)
 * — plant-wide. Retired equipment is left out altogether; the percentage
 * does not exist without equipment in service («—»).
 */
export class PmCoverage {
  private constructor(
    private readonly _inService: number,
    private readonly _withoutPlan: readonly Equipment[],
  ) {}

  static of(equipment: readonly Equipment[]): PmCoverage {
    const inService = equipment.filter((candidate) => !candidate.isRetired());
    return new PmCoverage(
      inService.length,
      inService.filter((candidate) => !candidate.hasPmPlan()),
    );
  }

  inService(): number {
    return this._inService;
  }

  withPlan(): number {
    return this._inService - this._withoutPlan.length;
  }

  /** The equipment in service without a plan, in the order given. */
  withoutPlan(): readonly Equipment[] {
    return this._withoutPlan;
  }

  /** Those with a plan, as a whole percentage of those in service; `null` with none. */
  coveragePercent(): number | null {
    return wholePercent(this.withPlan(), this._inService);
  }
}
