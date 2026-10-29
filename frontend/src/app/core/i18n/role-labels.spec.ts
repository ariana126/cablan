import { describe, expect, it } from 'vitest';

import { Role } from '../../api/model';
import { ROLE_LABELS } from './role-labels';

describe('ROLE_LABELS', () => {
  it('names the two maintenance roles in Persian', () => {
    expect(ROLE_LABELS[Role.technical_manager]).toBe('مدیر فنی');
    expect(ROLE_LABELS[Role.pm_inspector]).toBe('بازرس PM');
  });

  it('labels every role the API knows about', () => {
    for (const role of Object.values(Role)) {
      expect(ROLE_LABELS[role]).toBeTruthy();
    }
  });
});
