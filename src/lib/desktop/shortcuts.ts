import {
  getPlatformCapabilities,
  isTauriRuntime,
} from "../platform/capabilities";

export const DEFAULT_QUICK_CAPTURE_SHORTCUT = "Alt+Space";

export interface GlobalShortcutRegistrationState {
  registered: boolean;
  shortcut: string;
  supported: boolean;
  error: string | null;
}

// global-shortcut 플러그인은 desktop 확인 뒤에만 동적으로 불러온다.
export async function getGlobalShortcutRegistrationState(
  shortcut = DEFAULT_QUICK_CAPTURE_SHORTCUT,
): Promise<GlobalShortcutRegistrationState> {
  const capabilities = getPlatformCapabilities();

  if (!isTauriRuntime() || !capabilities.supportsGlobalShortcut) {
    return {
      registered: false,
      shortcut,
      supported: false,
      error: null,
    };
  }

  try {
    const { isRegistered } = await import(
      "@tauri-apps/plugin-global-shortcut"
    );

    return {
      registered: await isRegistered(shortcut),
      shortcut,
      supported: true,
      error: null,
    };
  } catch (caughtError) {
    return {
      registered: false,
      shortcut,
      supported: true,
      error:
        caughtError instanceof Error
          ? caughtError.message
          : "단축키 상태를 확인하지 못했습니다.",
    };
  }
}
