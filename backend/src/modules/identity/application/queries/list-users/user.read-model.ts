import { Role } from '@framework/domain';

// Never carries a password hash — nothing that reads a user list needs it,
// and it must never leave the write model.
export class UserReadModel {
  constructor(
    public readonly id: string,
    public readonly name: string,
    public readonly username: string,
    public readonly role: Role,
  ) {}
}
