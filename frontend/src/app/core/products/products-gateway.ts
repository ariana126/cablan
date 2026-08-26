import { Injectable, inject } from '@angular/core';
import { map, Observable } from 'rxjs';

import {
  ProductControllerList200Item,
  RegisterProductDto,
  UpdateProductDto,
} from '../../api/model';
import { ProductsService } from '../../api/products/products.service';

/** The shape this app works with — every field always present, unlike the generated response item. */
export interface AppProductMaterial {
  readonly id: string;
  readonly name: string;
}

export interface AppProductComponent {
  readonly id: string;
  readonly name: string;
  readonly materials: AppProductMaterial[];
}

export interface AppProduct {
  readonly id: string;
  readonly name: string;
  readonly components: AppProductComponent[];
}

function toAppProduct(item: ProductControllerList200Item): AppProduct {
  return {
    id: item.id ?? '',
    name: item.name ?? '',
    components: (item.components ?? []).map((component) => ({
      id: component.id ?? '',
      name: component.name ?? '',
      materials: (component.materials ?? []).map((material) => ({
        id: material.id ?? '',
        name: material.name ?? '',
      })),
    })),
  };
}

/**
 * Management- and System-Admin-only access to the product directory. Every writing method here
 * 401s or 403s for anyone else — see `features/products` for how the UI turns that into an
 * access-denied state. Registering or editing a product always creates its components and their
 * materials inline; there is no endpoint to attach an existing master `Component`/`Material` row.
 */
@Injectable({ providedIn: 'root' })
export class ProductsGateway {
  private readonly api = inject(ProductsService);

  list(): Observable<AppProduct[]> {
    return this.api.productControllerList().pipe(map((items) => items.map(toAppProduct)));
  }

  register(product: RegisterProductDto): Observable<void> {
    return this.api.productControllerRegister(product).pipe(map(() => undefined));
  }

  update(id: string, changes: UpdateProductDto): Observable<void> {
    return this.api.productControllerUpdate(id, changes);
  }

  delete(id: string): Observable<void> {
    return this.api.productControllerDelete(id);
  }
}
