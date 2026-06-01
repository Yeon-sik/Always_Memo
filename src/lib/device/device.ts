import type { Device } from "../../types";
import { createId } from "../storage/id";

const DEVICE_KEY = "localsyncmemo:device:v1";

// 사용자가 기기 이름을 지정하기 전까지 플랫폼과 id 일부로 기본 이름을 만든다.
function getDefaultDeviceName(deviceId: string): string {
  const platform =
    typeof navigator !== "undefined" && navigator.platform
      ? navigator.platform
      : "Windows";

  return `${platform} ${deviceId.slice(0, 6).toUpperCase()}`;
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
    const parsed = JSON.parse(rawValue) as Partial<Device>;

    if (
      typeof parsed.id === "string" &&
      typeof parsed.name === "string" &&
      typeof parsed.lastSeenAt === "string"
    ) {
      return parsed as Device;
    }
  } catch {
    return null;
  }

  return null;
}

// device 정보는 앱 데이터 스냅샷과 별도로 보관해 초기 부팅 때 바로 사용할 수 있다.
export function saveDevice(device: Device): void {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.setItem(DEVICE_KEY, JSON.stringify(device));
}

// 현재 실행 중인 기기를 가져오고, 없으면 새로 만든 뒤 lastSeenAt을 갱신한다.
export function getOrCreateDevice(): Device {
  const now = new Date().toISOString();
  const existingDevice = readStoredDevice();

  if (existingDevice) {
    const seenDevice = {
      ...existingDevice,
      lastSeenAt: now,
    };
    saveDevice(seenDevice);
    return seenDevice;
  }

  const id = createId();
  const device: Device = {
    id,
    name: getDefaultDeviceName(id),
    lastSeenAt: now,
    appVersion: null,
  };

  saveDevice(device);
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
