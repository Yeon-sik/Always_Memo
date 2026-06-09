Phase 4를 수행하세요.

목표:
Tauri v2 데스크톱 앱에서 앱이 tray에 숨어 있어도 Windows 어디서나 Quick Capture를 열 수 있게 합니다.
단, Windows web과 Android 앱은 절대 깨지면 안 됩니다. Tauri API는 desktop-only guard와 dynamic import/fallback으로 분리하세요.

반드시 먼저 확인:
1. git status --short
2. docs/specs/native-quick-capture.md
3. src-tauri/src/lib.rs
4. src-tauri/capabilities/*
5. src/lib/desktop/*
6. src/lib/platform/*
7. src/app/App.tsx
8. src/features/notes, src/features/tasks
9. 현재 tray/autostart/close-to-hide 구현

구현 범위:
1. tauri-plugin-global-shortcut 초기화
2. #[cfg(desktop)] guard 적용
3. capabilities에 global-shortcut permissions 추가
4. 기본 단축키 Alt+Space 등록 시도
5. 등록 실패 시 설정 화면에 "사용 불가" 상태 표시
6. 설정에서 대체 단축키를 저장할 수 있는 구조 준비
7. Quick Capture UI 컴포넌트 구현
8. Desktop에서는 quick-capture window 또는 always-on-top compact overlay
9. web/Android에서는 앱 내부 floating button 또는 Ctrl+K fallback
10. 입력 후 Enter 저장, Shift+Enter 줄바꿈, Esc 닫기
11. 기본 모드는 할 일
12. #memo prefix 또는 모드 토글로 메모 저장
13. 저장 즉시 local snapshot 업데이트
14. 이후 기존 sync engine이 push하도록 연결
15. tray menu에 Quick Capture / Open / Hide / Quit 구성
16. window focus/blur/hide 동작 안정화

권장 파일:
- src/features/quick-capture/QuickCapturePanel.tsx
- src/features/quick-capture/useQuickCapture.ts
- src/lib/desktop/quickCapture.ts
- src/lib/desktop/shortcuts.ts
- src/lib/desktop/tray.ts
- src/lib/platform/capabilities.ts
- src/components/SettingsPanel.tsx
- src-tauri/src/lib.rs
- src-tauri/capabilities/*.json

중요 제약:
1. src에서 @tauri-apps/plugin-global-shortcut static import 금지
2. desktop capability check 후 dynamic import 사용
3. Android/mobile compile path에 desktop-only Rust code가 들어가면 안 됨
4. #[cfg(desktop)] 유지
5. 기존 tray/autostart 기능 깨지지 않게 유지
6. Alt+Space 등록 실패를 crash로 처리하지 말 것
7. Supabase Auth/RLS는 Phase 5로 미룸
8. Fitness CRUD를 건드릴 경우 회귀를 만들지 말 것

UX:
1. Quick Capture는 검은 유리판 같은 compact premium panel
2. 입력 필드 autofocus
3. 저장 후 즉시 닫기
4. 실패 시 local 저장 실패/동기화 실패를 분리해 표시
5. Android/narrow width에서는 bottom sheet

검증:
1. npm.cmd run build
2. src-tauri에서 cargo check
3. npm.cmd run tauri:dev
4. 브라우저 dev server에서 Tauri API 없이 crash 없는지 확인
5. 앱 숨김 상태에서 Alt+Space 테스트
6. Alt+Space 충돌 시 fallback 상태 표시 테스트
7. tray Quick Capture 메뉴 테스트
8. Enter/Shift+Enter/Esc 테스트
9. 저장된 quick task/memo가 기록 탭과 메모/체크리스트에 반영되는지 확인

작업 후 보고:
- 변경 파일 목록
- desktop-only guard 적용 위치
- dynamic import 적용 위치
- web/Android fallback 방식
- 실행한 검증 명령과 결과
- 남은 리스크
