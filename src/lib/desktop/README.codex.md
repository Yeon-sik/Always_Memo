# Desktop library maintenance notes

This directory contains browser-safe wrappers around Tauri-only features.

Keep these boundaries:

- Load Tauri plugins dynamically or behind a platform guard so web builds do not crash.
- Preserve command names, event names, capability identifiers, and `#[cfg(desktop)]` behavior.
- The Rust tray implementation is authoritative; do not add a TypeScript tray facade without a live caller.
- Treat close-to-hide, tray actions, global shortcut, autostart, and Quick Capture as Windows runtime behavior, not as build-only evidence.

Current references:

- `docs/adr/2026-08-01-current-architecture.md`
- `docs/specs/platform-compatibility.md`
- GitHub issue #26 for Windows runtime and signed-installer verification
