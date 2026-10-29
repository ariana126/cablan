import { AggregateRoot, Identity } from '@framework/domain';

import { MaintenanceActivityRegistered } from './events/maintenance-activity-registered.event';
import { MaintenanceActivityRenamed } from './events/maintenance-activity-renamed.event';
import { MaintenanceActivityName } from './value/maintenance-activity-name.vo';

/** An entry of the reusable catalog of maintenance work («تعویض روغن»). */
export class MaintenanceActivity extends AggregateRoot {
  private constructor(
    id: Identity,
    private _name: MaintenanceActivityName,
  ) {
    super(id);
  }

  public static register(name: MaintenanceActivityName): MaintenanceActivity {
    const activity = new MaintenanceActivity(Identity.new(), name);
    activity.recordThat(
      new MaintenanceActivityRegistered(
        activity.id.asString(),
        name.asString(),
      ),
    );
    return activity;
  }

  /** Rehydrates from storage; records no event. */
  public static fromPersistence(
    id: Identity,
    name: MaintenanceActivityName,
  ): MaintenanceActivity {
    return new MaintenanceActivity(id, name);
  }

  public rename(name: MaintenanceActivityName): void {
    if (name.equals(this._name)) {
      return;
    }
    const previousName = this._name;
    this._name = name;
    this.recordThat(
      new MaintenanceActivityRenamed(
        this.id.asString(),
        previousName.asString(),
        name.asString(),
      ),
    );
  }

  public name(): MaintenanceActivityName {
    return this._name;
  }
}
