import { Identity } from '@framework/domain';
import {
  EquipmentNotFound,
  QcActivityNotFound,
} from '@maintenance/application/exceptions';
import { Equipment } from '@maintenance/domain/equipment.aggregate';
import { QcActivity } from '@maintenance/domain/qc-activity.aggregate';
import { EquipmentRepository } from '@maintenance/domain/service/equipment.repository';
import { QcActivityRepository } from '@maintenance/domain/service/qc-activity.repository';

/**
 * The equipment a QC route names, or its pinned 404 `equipment-not-found`
 * (the PM routes' `get()` answers the generic `entity-not-found`).
 */
export async function qcEquipmentOrFail(
  repository: EquipmentRepository,
  id: Identity,
): Promise<Equipment> {
  const equipment = await repository.find(id);
  if (!equipment) {
    throw EquipmentNotFound.withId(id);
  }
  return equipment;
}

/** The QC activity a route names, or the 404 `qc-activity-not-found`. */
export async function qcActivityOrFail(
  repository: QcActivityRepository,
  id: Identity,
): Promise<QcActivity> {
  const activity = await repository.find(id);
  if (!activity) {
    throw QcActivityNotFound.withId(id);
  }
  return activity;
}
