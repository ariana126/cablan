import { Injectable, inject } from '@angular/core';
import { map, Observable } from 'rxjs';

import {
  ComponentControllerList200Item,
  RegisterComponentDto,
  UpdateComponentDto,
} from '../../api/model';
import { ComponentsService } from '../../api/components/components.service';

/** The shape this app works with — every field always present, unlike the generated response item. */
export interface AppComponent {
  readonly id: string;
  readonly name: string;
}

function toAppComponent(item: ComponentControllerList200Item): AppComponent {
  return {
    id: item.id ?? '',
    name: item.name ?? '',
  };
}

/**
 * Management- and System-Admin-only access to the component directory. Every method here 401s
 * or 403s for anyone else — see `features/components` for how the UI turns that into an
 * access-denied state.
 */
@Injectable({ providedIn: 'root' })
export class ComponentsGateway {
  private readonly api = inject(ComponentsService);

  list(): Observable<AppComponent[]> {
    return this.api.componentControllerList().pipe(map((items) => items.map(toAppComponent)));
  }

  register(component: RegisterComponentDto): Observable<void> {
    return this.api.componentControllerRegister(component).pipe(map(() => undefined));
  }

  update(id: string, changes: UpdateComponentDto): Observable<void> {
    return this.api.componentControllerUpdate(id, changes);
  }

  delete(id: string): Observable<void> {
    return this.api.componentControllerDelete(id);
  }
}
