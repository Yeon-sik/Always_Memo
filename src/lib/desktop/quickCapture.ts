import {
  DEFAULT_QUICK_CAPTURE_SHORTCUT,
  getGlobalShortcutRegistrationState,
} from "./shortcuts";
import { getPlatformCapabilities } from "../platform/capabilities";

export const QUICK_CAPTURE_OPEN_EVENT = "quick-capture:open";

export interface DesktopQuickCaptureShortcutStatus {
  registered: boolean;
  shortcut: string;
  supported: boolean;
  error: string | null;
}

export interface DesktopQuickCaptureOpenResult {
  opened: boolean;
  supported: boolean;
  error: string | null;
}

export type UnlistenQuickCapture = () => void;

function unsupportedShortcutStatus(): DesktopQuickCaptureShortcutStatus {
  return {
    registered: false,
    shortcut: DEFAULT_QUICK_CAPTURE_SHORTCUT,
    supported: false,
    error: null,
  };
}

// Rust command는 Tauri 런타임에서만 동적으로 import한다.
export async function getDesktopQuickCaptureShortcutStatus(): Promise<DesktopQuickCaptureShortcutStatus> {
  if (!getPlatformCapabilities().isTauriDesktop) {
    return unsupportedShortcutStatus();
  }

  try {
    const { invoke } = await import("@tauri-apps/api/core");
    const status = await invoke<DesktopQuickCaptureShortcutStatus>(
      "quick_capture_shortcut_status",
    );
    const pluginStatus = await getGlobalShortcutRegistrationState(
      status.shortcut,
    );

    return {
      ...status,
      registered: status.registered || pluginStatus.registered,
      error: status.error ?? pluginStatus.error,
    };
  } catch (caughtError) {
    return {
      registered: false,
      shortcut: DEFAULT_QUICK_CAPTURE_SHORTCUT,
      supported: true,
      error:
        caughtError instanceof Error
          ? caughtError.message
          : "Quick Capture 단축키 상태를 확인하지 못했습니다.",
    };
  }
}

// tray 메뉴나 desktop 단축키와 같은 native 진입점을 앱 내부 overlay로 연결한다.
export async function openDesktopQuickCapture(): Promise<DesktopQuickCaptureOpenResult> {
  if (!getPlatformCapabilities().isTauriDesktop) {
    return {
      opened: false,
      supported: false,
      error: null,
    };
  }

  try {
    const { invoke } = await import("@tauri-apps/api/core");
    await invoke("show_quick_capture");

    return {
      opened: true,
      supported: true,
      error: null,
    };
  } catch (caughtError) {
    return {
      opened: false,
      supported: true,
      error:
        caughtError instanceof Error
          ? caughtError.message
          : "Quick Capture를 열지 못했습니다.",
    };
  }
}

// Tauri event listener도 desktop guard 뒤에서만 붙인다.
export async function listenForDesktopQuickCaptureOpen(
  handler: () => void,
): Promise<UnlistenQuickCapture> {
  if (!getPlatformCapabilities().isTauriDesktop) {
    return () => undefined;
  }

  try {
    const { listen } = await import("@tauri-apps/api/event");
    return await listen(QUICK_CAPTURE_OPEN_EVENT, handler);
  } catch {
    return () => undefined;
  }
}
