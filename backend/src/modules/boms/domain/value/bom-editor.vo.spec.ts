import { Role } from '@framework/domain';

import { BomEditor } from './bom-editor.vo';

describe('BomEditor', () => {
  it.each([[Role.Management], [Role.SystemAdmin]])(
    'an editor with the %p role is a reviewer',
    (role) => {
      expect(BomEditor.withRole(role).isReviewer()).toBe(true);
    },
  );

  it.each([[Role.QcInspector], [Role.Reporter], [null]])(
    'an editor with the %p role is not a reviewer',
    (role) => {
      expect(BomEditor.withRole(role).isReviewer()).toBe(false);
    },
  );
});
