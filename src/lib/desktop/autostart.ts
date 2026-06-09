import { getPlatformCapabilities } from "../platform/capabilities";

export interface AutostartResult {
  enabled: boolean;
  supported: boolean;
  error: string | null;
}

// 웹 개발 서버에서는 Tauri 플러그인이 없으므로 런타임을 먼저 확인한다.
async function loadAutostartPlugin() {
  return await import("@tauri-apps/plugin-autostart");
}

// 설정 패널 초기 표시를 위해 OS 자동 실행 등록 상태를 읽는다.
export async function getAutostartEnabled(): Promise<AutostartResult> {
  if (!getPlatformCapabilities().isTauriDesktop) {
    return {
      enabled: false,
      supported: false,
      error: null,
    };
  }

  try {
    const { isEnabled } = await loadAutostartPlugin();

    return {
      enabled: await isEnabled(),
      supported: true,
      error: null,
    };
  } catch (caughtError) {
    return {
      enabled: false,
      supported: false,
      error:
        caughtError instanceof Error
          ? caughtError.message
          : "부팅 시 자동 실행 상태를 확인하지 못했습니다.",
    };
  }
}

// 사용자의 토글 값을 Tauri autostart 플러그인 enable/disable로 적용한다.
export async function setAutostartEnabled(
  enabled: boolean,
): Promise<AutostartResult> {
  if (!getPlatformCapabilities().isTauriDesktop) {
    return {
      enabled: false,
      supported: false,
      error: "자동 실행 설정은 Tauri 데스크톱 앱에서만 사용할 수 있습니다.",
    };
  }

  try {
    const { disable, enable, isEnabled } = await loadAutostartPlugin();

    if (enabled) {
      await enable();
    } else {
      await disable();
    }

    return {
      enabled: await isEnabled(),
      supported: true,
      error: null,
    };
  } catch (caughtError) {
    return {
      enabled: false,
      supported: true,
      error:
        caughtError instanceof Error
          ? caughtError.message
          : "부팅 시 자동 실행 설정을 변경하지 못했습니다.",
    };
  }
}
