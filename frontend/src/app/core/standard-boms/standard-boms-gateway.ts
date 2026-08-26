import { Injectable, inject } from '@angular/core';
import { map, Observable } from 'rxjs';

import {
  RegisterStandardBomDto,
  StandardBomControllerList200Item,
  UpdateStandardBomDto,
} from '../../api/model';
import { StandardBomsService } from '../../api/standard-boms/standard-boms.service';

/** The shape this app works with — every field always present, unlike the generated response item. */
export interface AppStandardBomMaterial {
  readonly id: string;
  readonly name: string;
  readonly weight: number;
}

export interface AppStandardBomComponent {
  readonly id: string;
  readonly name: string;
  readonly materials: AppStandardBomMaterial[];
}

export interface AppStandardBom {
  readonly id: string;
  readonly miCode: string;
  readonly brand: string;
  readonly standardLength: number;
  readonly active: boolean;
  readonly description: string;
  readonly productId: string;
  readonly components: AppStandardBomComponent[];
}

function toAppStandardBom(item: StandardBomControllerList200Item): AppStandardBom {
  return {
    id: item.id ?? '',
    miCode: item.miCode ?? '',
    brand: item.brand ?? '',
    standardLength: item.standardLength ?? 0,
    active: item.active ?? false,
    description: item.description ?? '',
    productId: item.productId ?? '',
    components: (item.components ?? []).map((component) => ({
      id: component.id ?? '',
      name: component.name ?? '',
      materials: (component.materials ?? []).map((material) => ({
        id: material.id ?? '',
        name: material.name ?? '',
        weight: material.weight ?? 0,
      })),
    })),
  };
}

/**
 * Management- and System-Admin-only access to registering, editing or deleting a Standard BOM —
 * see `features/standard-boms` for how the UI turns a 403 from those calls into an access-denied
 * state. Registering or editing never creates a `Component`/`Material` master row: the composition
 * is always cloned server-side from the referenced product's *current* composition, and this
 * gateway only ever sends the `(componentId, materialId, weight)` triples the caller picked — see
 * `backend/src/modules/standard-boms/CLAUDE.md`.
 */
@Injectable({ providedIn: 'root' })
export class StandardBomsGateway {
  private readonly api = inject(StandardBomsService);

  list(): Observable<AppStandardBom[]> {
    return this.api.standardBomControllerList().pipe(map((items) => items.map(toAppStandardBom)));
  }

  register(standardBom: RegisterStandardBomDto): Observable<void> {
    return this.api.standardBomControllerRegister(standardBom).pipe(map(() => undefined));
  }

  update(id: string, changes: UpdateStandardBomDto): Observable<void> {
    return this.api.standardBomControllerUpdate(id, changes);
  }

  delete(id: string): Observable<void> {
    return this.api.standardBomControllerDelete(id);
  }
}
