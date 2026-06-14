import type { Device } from "../../types";
import { createId } from "../storage/id";

const DEVICE_KEY = "localsyncmemo:device:v1";

type StoredDevice = Partial<Device>;

// 사용자가 기기 이름을 지정하기 전까지 플랫폼과 id 일부로 기본 이름을 만든다.
function getDefaultDeviceName(deviceId: string): string {
  const platform =
    typeof navigator !== "undefined" && navigator.platform
      ? navigator.platform
      : "Windows";

  return `${platform} ${deviceId.slice(0, 6).toUpperCase()}`;
}

function isDevice(value: StoredDevice | null): value is Device {
  return Boolean(
    value &&
      typeof value.id === "string" &&
      typeof value.name === "string" &&
      typeof value.lastSeenAt === "string",
  );
}

// 같은 PC에서 앱을 다시 켰을 때 동일한 device id를 재사용한다.
function readStoredDevice(): Device | null {
  if (typeof window === "undefined") {
    return null;
  }

  const rawValue = window.localStorage.getItem(DEVICE_KEY);

  if (!rawValue) {
    return null;
  }

  try {
    const parsed = JSON.parse(rawValue) as StoredDevice;

    if (isDevice(parsed)) {
      return parsed;
    }
  } catch {
    return null;
  }

  return null;
}

async function readPersistedDevice(): Promise<Device | null> {
  try {
    const { invoke } = await import("@tauri-apps/api/core");
    const device = await invoke<StoredDevice | null>("load_persisted_device");

    return isDevice(device) ? device : null;
  } catch {
    return null;
  }
}

// localStorage는 브라우저 실행과 기존 설치본 마이그레이션용 fallback이다.
function saveDeviceToLocalStorage(device: Device): void {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.setItem(DEVICE_KEY, JSON.stringify(device));
}

// Tauri에서는 WebView 저장소보다 안정적인 앱 설정 디렉터리에 기기 식별자를 보관한다.
async function saveDevice(device: Device): Promise<void> {
  saveDeviceToLocalStorage(device);

  try {
    const { invoke } = await import("@tauri-apps/api/core");

    await invoke("save_persisted_device", { device });
  } catch {
    // Browser/dev fallback keeps using localStorage.
  }
}

// 현재 실행 중인 기기를 가져오고, 없으면 새로 만든 뒤 lastSeenAt을 갱신한다.
export async function getOrCreateDevice(): Promise<Device> {
  const now = new Date().toISOString();
  const existingDevice = (await readPersistedDevice()) ?? readStoredDevice();

  if (existingDevice) {
    const seenDevice = {
      ...existingDevice,
      lastSeenAt: now,
    };
    await saveDevice(seenDevice);
    return seenDevice;
  }

  const id = createId();
  const device: Device = {
    id,
    name: getDefaultDeviceName(id),
    lastSeenAt: now,
    appVersion: null,
  };

  await saveDevice(device);
  return device;
}

// devices 배열 안의 같은 id 항목을 교체하거나 새 기기를 추가한다.
export function upsertDevice(devices: Device[], device: Device): Device[] {
  const hasDevice = devices.some((item) => item.id === device.id);

  if (!hasDevice) {
    return [...devices, device];
  }

  return devices.map((item) => (item.id === device.id ? device : item));
}
