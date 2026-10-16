export class MaterialReadModel {
  constructor(
    public readonly id: string,
    public readonly name: string,
    // `null` when the material has no code.
    public readonly code: string | null,
  ) {}
}
