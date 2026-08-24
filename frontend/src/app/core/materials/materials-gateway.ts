import { Injectable, inject } from '@angular/core';
import { map, Observable } from 'rxjs';

import {
  MaterialControllerList200Item,
  RegisterMaterialDto,
  UpdateMaterialDto,
} from '../../api/model';
import { MaterialsService } from '../../api/materials/materials.service';

/** The shape this app works with — every field always present, unlike the generated response item. */
export interface AppMaterial {
  readonly id: string;
  readonly name: string;
}

function toAppMaterial(item: MaterialControllerList200Item): AppMaterial {
  return {
    id: item.id ?? '',
    name: item.name ?? '',
  };
}

/**
 * Management- and System-Admin-only access to the raw-material directory. Every method here 401s
 * or 403s for anyone else — see `features/materials` for how the UI turns that into an
 * access-denied state.
 */
@Injectable({ providedIn: 'root' })
export class MaterialsGateway {
  private readonly api = inject(MaterialsService);

  list(): Observable<AppMaterial[]> {
    return this.api.materialControllerList().pipe(map((items) => items.map(toAppMaterial)));
  }

  register(material: RegisterMaterialDto): Observable<void> {
    return this.api.materialControllerRegister(material).pipe(map(() => undefined));
  }

  update(id: string, changes: UpdateMaterialDto): Observable<void> {
    return this.api.materialControllerUpdate(id, changes);
  }

  delete(id: string): Observable<void> {
    return this.api.materialControllerDelete(id);
  }
}
