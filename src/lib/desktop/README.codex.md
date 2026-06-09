# Desktop Library — Codex Notes

이 폴더는 Tauri desktop-only 기능 wrapper 위치다.

해야 할 일:

```text
shortcuts.ts: global shortcut dynamic wrapper
quickCapture.ts: quick-capture window open/hide wrapper
tray.ts: tray action wrapper가 필요하면 추가
```

주의:

```text
web/Android에서 import crash가 없어야 한다.
Tauri plugin import는 dynamic import 또는 platform guard 뒤에서만 한다.
```

관련 문서:

```text
docs/specs/native-quick-capture.md
docs/specs/platform-compatibility.md
```
