/** An activity still waiting for its specialty. */
export class ActivityWithoutSpecialtyReadModel {
  constructor(
    public readonly id: string,
    public readonly name: string,
  ) {}
}
