import { ValueObject } from '@framework/domain';

// The weight-in-grams the caller attaches to each material line when
// registering or editing a daily BOM's composition. A module-owned copy of
// the same concept `standard-boms` defines for itself — each module owns its
// composition value objects independently, mirroring how `standard-boms`
// doesn't reuse `products`' own composition types.
export class Weight extends ValueObject {
  private constructor(private readonly grams: number) {
    super();
  }

  static ofGrams(grams: number): Weight {
    if (Number.isNaN(grams) || grams <= 0) {
      throw new Error('Weight value must be a positive number of grams');
    }
    return new Weight(grams);
  }

  public asGrams(): number {
    return this.grams;
  }
}
