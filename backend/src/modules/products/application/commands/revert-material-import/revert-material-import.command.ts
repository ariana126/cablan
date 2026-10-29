import { Identity } from '@framework/domain';

export class RevertMaterialImportCommand {
  constructor(public readonly importId: Identity) {}
}
