# Spec — Platform Compatibility Guard

## 1. 유지해야 할 플랫폼

```text
Windows 데스크톱 Tauri 앱
Windows 웹 앱/browser dev server
Android 앱/mobile build path
```

## 2. 공통 원칙

- local-first 기능은 모든 플랫폼에서 유지한다.
- Supabase 설정이 없어도 앱은 local-only로 동작한다.
- Tauri 전용 기능은 desktop-only로 분리한다.
- TypeScript에서 Tauri API static import는 platform crash를 유발할 수 있으므로 주의한다.

## 3. Rust guard

```rust
#[cfg(desktop)]
```

tray, autostart, global shortcut, close-to-hide는 desktop guard로 감싼다.

기존 모바일 entry point는 유지한다.

```rust
#[cfg_attr(mobile, tauri::mobile_entry_point)]
```

## 4. TypeScript guard

권장 패턴:

```ts
export async function loadDesktopApi() {
  if (typeof window === 'undefined') return null;
  if (!('__TAURI_INTERNALS__' in window)) return null;
  try {
    return await import('@tauri-apps/api/core');
  } catch {
    return null;
  }
}
```

실제 Tauri API와 plugin import는 사용 위치에서 dynamic import한다.

## 5. 기능 fallback

| 기능 | Windows Tauri | Windows Web | Android |
|---|---|---|---|
| Tray | 지원 | 숨김 | 숨김 |
| Global hotkey | 지원 | 앱 내부 shortcut | 앱 내부 버튼/bottom sheet |
| Close-to-hide | 지원 | 해당 없음 | 해당 없음 |
| Quick Capture | 별도 window | modal | bottom sheet |
| Supabase sync | 지원 | 지원 | 지원 |
| local-only | 지원 | 지원 | 지원 |
