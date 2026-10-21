import { AggregateRoot, Identity } from '@framework/domain';

import { MaterialDeleted } from './events/material-deleted.event';
import {
  MaterialEdited,
  MaterialFieldChange,
} from './events/material-edited.event';
import { MaterialRegistered } from './events/material-registered.event';
import { MaterialCode } from './value/material-code.vo';
import { MaterialName } from './value/material-name.vo';

export class Material extends AggregateRoot {
  private constructor(
    id: Identity,
    private _name: MaterialName,
    private _code: MaterialCode,
  ) {
    super(id);
  }

  public static register(name: MaterialName, code: MaterialCode): Material {
    const material = new Material(Identity.new(), name, code);
    material.recordThat(
      new MaterialRegistered(
        material.id.asString(),
        name.asString(),
        code.asString(),
      ),
    );
    return material;
  }

  /**
   * Rehydrates a `Material` from storage — for `PrismaMaterialRepository`'s
   * `toDomain()` only. Unlike `register()`, this records no event: loading
   * an existing row is not a new business fact.
   */
  public static fromPersistence(
    id: Identity,
    name: MaterialName,
    code: MaterialCode,
  ): Material {
    return new Material(id, name, code);
  }

  /**
   * Applies an edit — both name and code are always given — and records
   * exactly one `MaterialEdited` event carrying only the fields whose value
   * actually changed. A field resent with its current value is not a change,
   * and an edit that changes nothing records no event at all — so one update
   * never yields several audit entries, nor a "Copper -> Copper" line.
   */
  public edit(fields: { name: MaterialName; code: MaterialCode }): void {
    const changes: MaterialFieldChange[] = [];

    if (!fields.name.equals(this._name)) {
      changes.push({
        field: 'name',
        previousValue: this._name.asString(),
        newValue: fields.name.asString(),
      });
      this._name = fields.name;
    }

    if (!fields.code.equals(this._code)) {
      changes.push({
        field: 'code',
        previousValue: this._code.asString(),
        newValue: fields.code.asString(),
      });
      this._code = fields.code;
    }

    if (changes.length > 0) {
      this.recordThat(new MaterialEdited(this.id.asString(), changes));
    }
  }

  /**
   * Hard delete: unlike `User.delete()`, a material has no relations to any
   * other BOM entity yet — nothing references it, so the row is removed
   * outright by the repository's `delete()` rather than kept behind a flag.
   */
  public delete(): void {
    this.recordThat(
      new MaterialDeleted(
        this.id.asString(),
        this._name.asString(),
        this._code.asString(),
      ),
    );
  }

  public name(): MaterialName {
    return this._name;
  }

  public code(): MaterialCode {
    return this._code;
  }
}
