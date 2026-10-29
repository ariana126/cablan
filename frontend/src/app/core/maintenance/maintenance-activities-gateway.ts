import { Injectable, inject } from '@angular/core';
import { map, Observable } from 'rxjs';

import { MaintenanceActivitiesService } from '../../api/maintenance-activities/maintenance-activities.service';
import { MaintenanceActivityControllerList200Item } from '../../api/model';

/** One activity of the reusable maintenance catalog («تعویض روغن»). */
export interface AppMaintenanceActivity {
  readonly id: string;
  readonly name: string;
}

const toAppMaintenanceActivity = (
  item: MaintenanceActivityControllerList200Item,
): AppMaintenanceActivity => ({ id: item.id ?? '', name: item.name ?? '' });

/** The maintenance-activity catalog — System Admin and Technical Manager only. */
@Injectable({ providedIn: 'root' })
export class MaintenanceActivitiesGateway {
  private readonly api = inject(MaintenanceActivitiesService);

  list(): Observable<AppMaintenanceActivity[]> {
    return this.api
      .maintenanceActivityControllerList()
      .pipe(map((items) => items.map(toAppMaintenanceActivity)));
  }

  register(name: string): Observable<void> {
    return this.api.maintenanceActivityControllerRegister({ name }).pipe(map(() => undefined));
  }

  rename(id: string, name: string): Observable<void> {
    return this.api.maintenanceActivityControllerRename(id, { name });
  }
}
