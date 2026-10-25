import { Injectable, inject } from '@angular/core';
import { map, Observable } from 'rxjs';

import {
  BomControllerList200Item,
  BomControllerWeightDifferences200LinesItem,
  RegisterBomDto,
  UpdateBomDto,
} from '../../api/model';
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

/** One material line of a daily BOM against the standard BOM it was cloned from. `difference` is
 * the API's absolute deviation `|actualWeight − standardWeight|`; the direction is read off the two
 * weights. `standardWeight` is 0 when the pair is no longer on the standard BOM. */
export interface AppBomWeightDifference {
  readonly componentId: string;
  readonly componentName: string;
  readonly materialId: string;
  readonly materialName: string;
  readonly actualWeight: number;
  readonly standardWeight: number;
  readonly difference: number;
}

function toAppBomWeightDifference(
  line: BomControllerWeightDifferences200LinesItem,
): AppBomWeightDifference {
  return {
    componentId: line.componentId ?? '',
    componentName: line.componentName ?? '',
    materialId: line.materialId ?? '',
    materialName: line.materialName ?? '',
    actualWeight: line.actualWeight ?? 0,
    standardWeight: line.standardWeight ?? 0,
    difference: line.difference ?? 0,
  };
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

  /** Answers the new daily BOM's id. */
  register(bom: RegisterBomDto): Observable<string> {
    return this.api.bomControllerRegister(bom).pipe(map((registered) => registered.id ?? ''));
  }

  update(id: string, changes: UpdateBomDto): Observable<void> {
    return this.api.bomControllerUpdate(id, changes);
  }

  /** Each material line's weight against the standard BOM's current composition. */
  weightDifferences(id: string): Observable<AppBomWeightDifference[]> {
    return this.api
      .bomControllerWeightDifferences(id)
      .pipe(map((response) => (response.lines ?? []).map(toAppBomWeightDifference)));
  }

  delete(id: string): Observable<void> {
    return this.api.bomControllerDelete(id);
  }

  /** Approves a pending daily BOM as the current user. Management and System Admin only (403
   * otherwise); one already approved or rejected answers 409 `bom-already-reviewed` — only an edit
   * sends it back to pending. */
  approve(id: string): Observable<void> {
    return this.api.bomControllerApprove(id);
  }

  /** Rejects a pending daily BOM as the current user, with `reason` as its management note. The
   * same 403 and 409 rules as `approve`; a blank reason answers 400 `rejection-reason-required`. */
  reject(id: string, reason: string): Observable<void> {
    return this.api.bomControllerReject(id, { reason });
  }
}
