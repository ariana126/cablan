import { AggregateRoot, Identity } from '@framework/domain';

import { ComponentDeleted } from './events/component-deleted.event';
import { ComponentRegistered } from './events/component-registered.event';
import { ComponentRenamed } from './events/component-renamed.event';
import { ComponentName } from './value/component-name.vo';

export class Component extends AggregateRoot {
  private constructor(
    id: Identity,
    private _name: ComponentName,
  ) {
    super(id);
  }

  public static register(name: ComponentName): Component {
    const component = new Component(Identity.new(), name);
    component.recordThat(
      new ComponentRegistered(component.id.asString(), name.asString()),
    );
    return component;
  }

  /**
   * Rehydrates a `Component` from storage — for `PrismaComponentRepository`'s
   * `toDomain()` only. Unlike `register()`, this records no event: loading
   * an existing row is not a new business fact.
   */
  public static fromPersistence(id: Identity, name: ComponentName): Component {
    return new Component(id, name);
  }

  public rename(name: ComponentName): void {
    const previousName = this._name;
    this._name = name;
    this.recordThat(
      new ComponentRenamed(
        this.id.asString(),
        previousName.asString(),
        name.asString(),
      ),
    );
  }

  /**
   * Hard delete: a component has no relations to any other BOM entity — no
   * foreign key, no domain relation to a material or a product — so nothing
   * references it and the row is removed outright by the repository's
   * `delete()` rather than kept behind a flag.
   */
  public delete(): void {
    this.recordThat(
      new ComponentDeleted(this.id.asString(), this._name.asString()),
    );
  }

  public name(): ComponentName {
    return this._name;
  }
}
