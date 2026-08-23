import { Injectable, inject } from '@angular/core';
import { map, Observable } from 'rxjs';

import { RegisterUserDto, Role, UpdateUserDto, UserControllerList200Item } from '../../api/model';
import { UsersService } from '../../api/users/users.service';

/** The shape this app works with — every field always present, unlike the generated response item. */
export interface AppUser {
  readonly id: string;
  readonly name: string;
  readonly username: string;
  readonly role: Role;
}

function toAppUser(item: UserControllerList200Item): AppUser {
  return {
    id: item.id ?? '',
    name: item.name ?? '',
    username: item.username ?? '',
    role: item.role ?? Role.reporter,
  };
}

/**
 * System-Admin-only access to the user directory. Every method here 401s or 403s for anyone else —
 * see `features/users` for how the UI turns that into an access-denied state.
 */
@Injectable({ providedIn: 'root' })
export class UsersGateway {
  private readonly api = inject(UsersService);

  list(): Observable<AppUser[]> {
    return this.api.userControllerList().pipe(map((items) => items.map(toAppUser)));
  }

  register(user: RegisterUserDto): Observable<void> {
    return this.api.userControllerRegister(user);
  }

  /** `changes` carries only the fields being edited — an omitted field is left unchanged server-side. */
  update(id: string, changes: UpdateUserDto): Observable<void> {
    return this.api.userControllerUpdate(id, changes);
  }

  delete(id: string): Observable<void> {
    return this.api.userControllerDelete(id);
  }
}
