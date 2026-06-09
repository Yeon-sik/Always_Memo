export interface PlatformCapabilities {
  isAndroidLike: boolean;
  isBrowser: boolean;
  isTauriDesktop: boolean;
  supportsGlobalShortcut: boolean;
  supportsQuickCaptureWindow: boolean;
  supportsTray: boolean;
}

// Tauri 전용 API를 import하기 전 런타임 존재 여부를 먼저 확인한다.
export function isTauriRuntime(): boolean {
  return typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;
}

// Android WebView와 모바일 브라우저에서는 desktop-only 기능을 숨긴다.
export function isAndroidLikeRuntime(): boolean {
  if (typeof navigator === "undefined") {
    return false;
  }

  return /android|iphone|ipad|ipod/i.test(navigator.userAgent);
}

// 기능별 지원 여부를 한 곳에서 판정해 web/Android crash를 막는다.
export function getPlatformCapabilities(): PlatformCapabilities {
  const isBrowser = typeof window !== "undefined";
  const isAndroidLike = isAndroidLikeRuntime();
  const isTauriDesktop = isTauriRuntime() && !isAndroidLike;

  return {
    isAndroidLike,
    isBrowser,
    isTauriDesktop,
    supportsGlobalShortcut: isTauriDesktop,
    supportsQuickCaptureWindow: isTauriDesktop,
    supportsTray: isTauriDesktop,
  };
}
