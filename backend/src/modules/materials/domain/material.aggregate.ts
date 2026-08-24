import { AggregateRoot, Identity } from '@framework/domain';

import { MaterialDeleted } from './events/material-deleted.event';
import { MaterialRegistered } from './events/material-registered.event';
import { MaterialRenamed } from './events/material-renamed.event';
import { MaterialName } from './value/material-name.vo';

export class Material extends AggregateRoot {
  private constructor(
    id: Identity,
    private _name: MaterialName,
  ) {
    super(id);
  }

  public static register(name: MaterialName): Material {
    const material = new Material(Identity.new(), name);
    material.recordThat(
      new MaterialRegistered(material.id.asString(), name.asString()),
    );
    return material;
  }

  /**
   * Rehydrates a `Material` from storage — for `PrismaMaterialRepository`'s
   * `toDomain()` only. Unlike `register()`, this records no event: loading
   * an existing row is not a new business fact.
   */
  public static fromPersistence(id: Identity, name: MaterialName): Material {
    return new Material(id, name);
  }

  public rename(name: MaterialName): void {
    const previousName = this._name;
    this._name = name;
    this.recordThat(
      new MaterialRenamed(
        this.id.asString(),
        previousName.asString(),
        name.asString(),
      ),
    );
  }

  /**
   * Hard delete: unlike `User.delete()`, a material has no relations to any
   * other BOM entity yet — nothing references it, so the row is removed
   * outright by the repository's `delete()` rather than kept behind a flag.
   */
  public delete(): void {
    this.recordThat(
      new MaterialDeleted(this.id.asString(), this._name.asString()),
    );
  }

  public name(): MaterialName {
    return this._name;
  }
}
