# src-tauri/src — Codex Notes

Rust 진입점에서는 desktop-only 기능을 guard해야 한다.

해야 할 일:

```text
global-shortcut plugin 추가 시 #[cfg(desktop)] 사용
quick-capture window 생성 command 또는 setup 추가
tray menu에 Quick Capture 항목 추가
기존 open/hide/quit 동작 유지
close-to-hide 유지
```

주의:

```text
#[cfg_attr(mobile, tauri::mobile_entry_point)] 유지
Android/mobile build path를 깨지 않는다.
```
