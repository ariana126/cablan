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
 * The user directory, plus the one call that is not part of it.
 *
 * Every method here but `me()` is System-Admin-only and 401s or 403s for anyone else — see
 * `features/users` for how the UI turns that into an access-denied state. `me()` is the exception:
 * it answers for whoever holds the token, so every role may call it.
 */
@Injectable({ providedIn: 'root' })
export class UsersGateway {
  private readonly api = inject(UsersService);

  list(): Observable<AppUser[]> {
    return this.api.userControllerList().pipe(map((items) => items.map(toAppUser)));
  }

  /**
   * The signed-in user, resolved from the bearer token alone.
   *
   * The one method here any role may call — everything else on this gateway is System-Admin-only.
   * It exists because the JWT carries no role claim (deliberately: see the API's
   * `AccessTokenIssuer`), so this is the only way the app can learn what to show.
   */
  me(): Observable<AppUser> {
    return this.api.userControllerMe().pipe(map(toAppUser));
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
