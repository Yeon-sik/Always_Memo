# src-tauri/capabilities — Codex Notes

Tauri capability 파일은 desktop plugin 권한 추가 시 반드시 확인한다.

확인 대상:

```text
global-shortcut 권한
window 권한
clipboard 권한
shell/open URL 권한
tray 관련 권한이 필요한지 여부
```

주의:

```text
불필요하게 넓은 권한을 열지 않는다.
web/Android fallback에는 Tauri capability가 필요하지 않다.
```
