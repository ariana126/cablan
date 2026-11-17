import { AggregateRoot, Identity } from '@framework/domain';

import { QcActivityDefined } from './events/qc-activity-defined.event';
import { QcActivityDeleted } from './events/qc-activity-deleted.event';
import { QcActivityRenamed } from './events/qc-activity-renamed.event';
import { QcActivityName } from './value/qc-activity-name.vo';

/**
 * An entry of the catalog of quality-control work («فعالیت QC», issue
 * #119), defined on its own and assigned to equipment afterwards (the
 * assignments are the equipment's). Its name is unique, which the handlers
 * check. While assigned or recorded it can be neither renamed nor deleted
 * (issue #94) — the handlers' guard, not this aggregate's; the System Admin
 * may still correct its name (issue #110).
 */
export class QcActivity extends AggregateRoot {
  private constructor(
    id: Identity,
    private _name: QcActivityName,
  ) {
    super(id);
  }

  public static define(name: QcActivityName): QcActivity {
    const activity = new QcActivity(Identity.new(), name);
    activity.recordThat(
      new QcActivityDefined(activity.id.asString(), name.asString()),
    );
    return activity;
  }

  /** Rehydrates from storage; records no event. */
  public static fromPersistence(
    id: Identity,
    name: QcActivityName,
  ): QcActivity {
    return new QcActivity(id, name);
  }

  /** One event, none when the name is unchanged. */
  public rename(name: QcActivityName): void {
    if (name.equals(this._name)) {
      return;
    }
    const previousName = this._name;
    this._name = name;
    this.recordThat(
      new QcActivityRenamed(
        this.id.asString(),
        previousName.asString(),
        name.asString(),
      ),
    );
  }

  /** Deleted from the catalog; the repository's `delete()` removes it. */
  public delete(): void {
    this.recordThat(
      new QcActivityDeleted(this.id.asString(), this._name.asString()),
    );
  }

  /**
   * Whether an edit changes nothing but correctable fields (issue #110):
   * always — its name, its only editable field, is correctable.
   */
  public changesOnlyCorrectableFields(): boolean {
    return true;
  }

  public name(): QcActivityName {
    return this._name;
  }
}
