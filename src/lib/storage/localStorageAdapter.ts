import type { Device, LocalDataSnapshot, Note, Task } from "../../types";
import { createEmptySnapshot, type StorageAdapter } from "./storageAdapter";

const STORAGE_KEY = "localsyncmemo:snapshot:v1";

interface StoredEnvelope {
  version: 1;
  snapshot: LocalDataSnapshot;
}

// localStorage에서 읽은 JSON은 unknown이므로 런타임 타입 가드로 검증한다.
function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isNote(value: unknown): value is Note {
  return (
    isRecord(value) &&
    typeof value.id === "string" &&
    typeof value.title === "string" &&
    typeof value.content === "string" &&
    typeof value.updatedAt === "string" &&
    (typeof value.deletedAt === "string" || value.deletedAt === null) &&
    typeof value.deviceId === "string"
  );
}

function normalizeTask(value: unknown): Task | null {
  if (
    !isRecord(value) ||
    typeof value.id !== "string" ||
    typeof value.text !== "string" ||
    typeof value.isDone !== "boolean" ||
    typeof value.orderIndex !== "number" ||
    typeof value.updatedAt !== "string" ||
    !(typeof value.deletedAt === "string" || value.deletedAt === null) ||
    typeof value.deviceId !== "string"
  ) {
    return null;
  }

  const dueDate =
    typeof value.dueDate === "string" || value.dueDate === null
      ? value.dueDate
      : null;
  const dueTime =
    typeof value.dueTime === "string" || value.dueTime === null
      ? value.dueTime
      : null;

  return {
    id: value.id,
    text: value.text,
    isDone: value.isDone,
    orderIndex: value.orderIndex,
    dueDate,
    dueTime,
    updatedAt: value.updatedAt,
    deletedAt: value.deletedAt,
    deviceId: value.deviceId,
  };
}

function isDevice(value: unknown): value is Device {
  return (
    isRecord(value) &&
    typeof value.id === "string" &&
    typeof value.name === "string" &&
    typeof value.lastSeenAt === "string" &&
    (typeof value.appVersion === "string" ||
      value.appVersion === null ||
      value.appVersion === undefined)
  );
}

// 저장된 스냅샷에서 잘못된 row는 버리고 앱이 로드 가능한 데이터만 남긴다.
function normalizeSnapshot(value: unknown): LocalDataSnapshot {
  if (!isRecord(value)) {
    return createEmptySnapshot();
  }

  const notes = Array.isArray(value.notes) ? value.notes.filter(isNote) : [];
  const tasks = Array.isArray(value.tasks)
    ? value.tasks.flatMap((task) => {
        const normalizedTask = normalizeTask(task);
        return normalizedTask ? [normalizedTask] : [];
      })
    : [];
  const devices = Array.isArray(value.devices)
    ? value.devices.filter(isDevice)
    : [];

  return { notes, tasks, devices };
}

// v1 envelope와 초기 개발 중 저장했을 수 있는 raw snapshot 형태를 모두 읽는다.
function parseStoredValue(rawValue: string): LocalDataSnapshot {
  const parsed = JSON.parse(rawValue) as unknown;

  if (isRecord(parsed) && parsed.version === 1 && "snapshot" in parsed) {
    return normalizeSnapshot(parsed.snapshot);
  }

  return normalizeSnapshot(parsed);
}

// 브라우저 localStorage에 앱 전체 스냅샷을 저장하는 로컬 우선 저장소다.
export class LocalStorageAdapter implements StorageAdapter {
  async load(): Promise<LocalDataSnapshot> {
    if (typeof window === "undefined") {
      return createEmptySnapshot();
    }

    const rawValue = window.localStorage.getItem(STORAGE_KEY);

    if (!rawValue) {
      return createEmptySnapshot();
    }

    try {
      return parseStoredValue(rawValue);
    } catch {
      throw new Error("저장된 로컬 데이터를 읽을 수 없습니다.");
    }
  }

  async save(snapshot: LocalDataSnapshot): Promise<void> {
    if (typeof window === "undefined") {
      return;
    }

    try {
      const envelope: StoredEnvelope = {
        version: 1,
        snapshot,
      };

      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(envelope));
    } catch {
      throw new Error("로컬 저장소에 변경사항을 저장하지 못했습니다.");
    }
  }
}

export const localStorageAdapter = new LocalStorageAdapter();
