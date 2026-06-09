# Spec — Desktop Native Quick Capture

## 1. 목적

Tauri desktop에서는 앱이 tray에 숨어 있어도 어디서나 빠르게 메모/할 일을 입력한다. web/Android에서는 같은 컴포넌트를 앱 내부 floating quick capture 또는 bottom sheet로 제공한다.

## 2. Desktop 기능

```text
tauri-plugin-global-shortcut 추가
Rust setup에서 #[cfg(desktop)]로 plugin 초기화
기본 shortcut: Alt+Space
등록 실패 시 설정 화면에 unavailable 표시
대체 shortcut 제안: Ctrl+Alt+Space
Quick Capture 전용 window 생성
label: quick-capture
center, always-on-top, 가능하면 skip taskbar
blur/Esc/저장 후 hide
```

## 3. 입력 UX

```text
기본 모드: 할 일
#memo prefix 또는 토글로 메모 저장
Enter 저장
Shift+Enter 줄바꿈
Esc 닫기
저장 즉시 local snapshot 업데이트
이후 sync engine이 push
```

## 4. Tray menu

```text
Quick Capture
Open
Hide
Quit
```

## 5. Web/Android fallback

- Tauri API가 없으면 global shortcut 기능을 import하지 않는다.
- 앱 내부 `Ctrl+K` 또는 floating button으로 Quick Capture를 연다.
- Android에서는 soft keyboard와 safe area를 고려해 bottom sheet로 표시한다.
- fallback도 동일한 QuickCapture component를 사용해 유지보수 비용을 줄인다.

## 6. 구현 위치 제안

```text
src/lib/desktop/shortcuts.ts
src/lib/desktop/quickCapture.ts
src/lib/platform/capabilities.ts
src/features/notes/QuickCapture.tsx
src-tauri/src/lib.rs
```

## 7. 검증

```powershell
npm.cmd run build
Push-Location .\src-tauri
cargo check
Pop-Location
npm.cmd run tauri:dev
```

브라우저 dev server에서도 crash가 없어야 한다.
