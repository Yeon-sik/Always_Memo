# Platform Library — Codex Notes

이 폴더는 platform capability detection을 위한 신규 경계다.

제안 파일:

```text
capabilities.ts
```

목표:

```text
isTauriDesktop
isBrowser
isAndroidLike
supportsGlobalShortcut
supportsTray
supportsQuickCaptureWindow
```

주의:

```text
환경 감지는 실패해도 안전한 쪽으로 fallback한다.
Tauri API 존재를 가정하지 않는다.
```
