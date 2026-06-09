import type { Device } from "../../types";

export interface MergeableEntity {
  id: string;
  updatedAt: string;
  deletedAt: string | null;
}

export function shouldUseIncomingEntity<T extends MergeableEntity>(
  current: T | undefined,
  incoming: T,
): boolean {
  if (!current) {
    return true;
  }

  const currentUpdatedAt = Date.parse(current.updatedAt);
  const incomingUpdatedAt = Date.parse(incoming.updatedAt);

  if (incomingUpdatedAt > currentUpdatedAt) {
    return true;
  }

  if (incomingUpdatedAt < currentUpdatedAt) {
    return false;
  }

  const currentIsTombstone = current.deletedAt !== null;
  const incomingIsTombstone = incoming.deletedAt !== null;

  return incomingIsTombstone && !currentIsTombstone;
}

export function mergeEntities<T extends MergeableEntity>(
  localEntities: T[],
  incomingEntities: T[],
): T[] {
  const byId = new Map(localEntities.map((entity) => [entity.id, entity]));

  for (const incomingEntity of incomingEntities) {
    const currentEntity = byId.get(incomingEntity.id);

    if (shouldUseIncomingEntity(currentEntity, incomingEntity)) {
      byId.set(incomingEntity.id, incomingEntity);
    }
  }

  return Array.from(byId.values());
}

export function mergeDevices(
  localDevices: Device[],
  incomingDevices: Device[],
): Device[] {
  const byId = new Map(localDevices.map((device) => [device.id, device]));

  for (const incomingDevice of incomingDevices) {
    const currentDevice = byId.get(incomingDevice.id);

    if (
      !currentDevice ||
      Date.parse(incomingDevice.lastSeenAt) >= Date.parse(currentDevice.lastSeenAt)
    ) {
      byId.set(incomingDevice.id, incomingDevice);
    }
  }

  return Array.from(byId.values()).sort((first, second) =>
    second.lastSeenAt.localeCompare(first.lastSeenAt),
  );
}
