import { Injectable, inject } from '@angular/core';
import { map, Observable } from 'rxjs';

import { BomControllerList200Item, RegisterBomDto, UpdateBomDto } from '../../api/model';
import { BomsService } from '../../api/boms/boms.service';

/** The shape this app works with — every field always present, unlike the generated response item. */
export interface AppBomMaterial {
  readonly id: string;
  readonly name: string;
  readonly weight: number;
}

export interface AppBomComponent {
  readonly id: string;
  readonly name: string;
  readonly materials: AppBomMaterial[];
}

export interface AppBom {
  readonly id: string;
  readonly standardBomId: string;
  readonly orderNumber: string;
  readonly trackingNumber: string;
  readonly description: string;
  readonly components: AppBomComponent[];
}

function toAppBom(item: BomControllerList200Item): AppBom {
  return {
    id: item.id ?? '',
    standardBomId: item.standardBomId ?? '',
    orderNumber: item.orderNumber ?? '',
    trackingNumber: item.trackingNumber ?? '',
    description: item.description ?? '',
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
 * QC-Inspector-, Management- and System-Admin-only access to registering, editing or deleting a
 * daily BOM — see `features/boms` for how the UI turns a 403 from those calls into an access-denied
 * state. Unlike its sibling gateways, listing carries no role restriction at all (any authenticated
 * user may browse), so there is no page-wide "forbidden" state to compute from this gateway's `list`
 * call — only from an actual register/edit/delete attempt. Registering or editing never creates a
 * `Component`/`Material` master row: the composition is always cloned server-side from the
 * referenced standard BOM's *current* composition, and this gateway only ever sends the
 * `(componentId, materialId, weight)` triples the caller picked — see `backend/src/modules/boms/CLAUDE.md`.
 */
@Injectable({ providedIn: 'root' })
export class BomsGateway {
  private readonly api = inject(BomsService);

  list(): Observable<AppBom[]> {
    return this.api.bomControllerList().pipe(map((items) => items.map(toAppBom)));
  }

  register(bom: RegisterBomDto): Observable<void> {
    return this.api.bomControllerRegister(bom).pipe(map(() => undefined));
  }

  update(id: string, changes: UpdateBomDto): Observable<void> {
    return this.api.bomControllerUpdate(id, changes);
  }

  delete(id: string): Observable<void> {
    return this.api.bomControllerDelete(id);
  }
}
