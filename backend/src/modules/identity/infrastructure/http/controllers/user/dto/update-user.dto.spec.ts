import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';

import { UpdateUserDto } from './update-user.dto';

async function invalidFields(role: unknown) {
  const errors = await validate(plainToInstance(UpdateUserDto, { role }));
  return errors.map((error) => error.property);
}

describe('UpdateUserDto role', () => {
  // Issue #130: a user's role can be changed to the factory manager.
  it('accepts the factory manager', async () => {
    expect(await invalidFields('factory_manager')).toEqual([]);
  });

  it('rejects a role the system does not know', async () => {
    expect(await invalidFields('plant_owner')).toEqual(['role']);
  });
});
