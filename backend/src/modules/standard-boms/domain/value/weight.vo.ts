import { ValueObject } from '@framework/domain';

// The weight-in-grams the caller attaches to each material line when
// registering or editing a standard BOM's composition.
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
