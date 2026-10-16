import { Identity } from '@framework/domain';

export class DeleteMaterialCommand {
  constructor(public readonly materialId: Identity) {}
}
