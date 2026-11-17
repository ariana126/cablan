import { Identity } from '@framework/domain';

/**
 * One piece of equipment's QC activities and their last executions — the QC
 * folder's (`/qc-equipment/:id`) and the inspection view's
 * (`/qc-inspections/:id`) read alike, retired equipment included.
 */
export class GetQcEquipmentQuery {
  constructor(public readonly equipmentId: Identity) {}
}
