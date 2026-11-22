import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';

import { RegisterUserDto } from './register-user.dto';

async function invalidFields(role: unknown) {
  const errors = await validate(
    plainToInstance(RegisterUserDto, {
      name: 'Kamrani',
      username: 'kamrani',
      password: 'Passw0rd!',
      role,
    }),
  );
  return errors.map((error) => error.property);
}

describe('RegisterUserDto role', () => {
  // Issue #130: the factory manager is a role a user can be given.
  it('accepts the factory manager', async () => {
    expect(await invalidFields('factory_manager')).toEqual([]);
  });

  it('rejects a role the system does not know', async () => {
    expect(await invalidFields('plant_owner')).toEqual(['role']);
  });
});
