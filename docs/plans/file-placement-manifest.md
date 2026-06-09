# File Placement Manifest

이미지 기준 실제 프로젝트 루트는 `C:\Github\메모\MemoNote`이다. 이 workpack은 해당 루트 아래에 다음 파일을 추가한다.

| 대상 경로 | 목적 |
|---|---|
| `docs/plans/codex-start-here.md` | Codex가 가장 먼저 읽을 시작 문서 |
| `docs/plans/codex-implementation-roadmap.md` | Phase별 구현 순서 |
| `docs/plans/acceptance-checklist.md` | 완료 기준/검수 체크리스트 |
| `docs/plans/codex-review-prompt.md` | Codex에게 붙여넣을 프롬프트 |
| `docs/plans/version-synthesis.md` | Version.md 기반 요약 |
| `docs/plans/file-placement-manifest.md` | 이 파일 배치표 |
| `docs/specs/codex-command-master.md` | 전체 제품/기술 명령서 |
| `docs/specs/life-command-center.md` | 기록 탭 대시보드 명세 |
| `docs/specs/record-aggregation-api.md` | 집계 selector API 계약 |
| `docs/specs/fitness-full-crud-sync.md` | 운동/식사/체중 CRUD와 tombstone 명세 |
| `docs/specs/native-quick-capture.md` | Tauri global hotkey/tray Quick Capture 명세 |
| `docs/specs/auth-rls-share.md` | Supabase Auth/RLS 및 X 공유 명세 |
| `docs/specs/design-system-luxury-dashboard.md` | 프리미엄 블랙 대시보드 디자인 시스템 |
| `docs/specs/platform-compatibility.md` | Windows desktop/web/Android 호환성 경계 |
| `docs/assets/reference-directory-structure.png` | 사용자가 제공한 디렉터리 구조 참고 이미지 |
| `src/features/records/README.codex.md` | 기록 탭 구현 위치별 지시 |
| `src/features/fitness/README.codex.md` | 운동 탭 구현 위치별 지시 |
| `src/features/notes/README.codex.md` | Quick Capture와 메모 연결 지시 |
| `src/features/tasks/README.codex.md` | Quick Action과 체크리스트 연결 지시 |
| `src/lib/sync/README.codex.md` | LWW/tombstone merge 지시 |
| `src/lib/auth/README.codex.md` | Auth session layer 지시 |
| `src/lib/desktop/README.codex.md` | desktop wrapper 지시 |
| `src/lib/platform/README.codex.md` | capability detection 지시 |
| `src-tauri/src/README.codex.md` | Rust desktop-only 구현 지시 |
| `src-tauri/capabilities/README.codex.md` | Tauri capability 검토 지시 |
| `supabase/README.codex.md` | Supabase 적용 전 주의 사항 |
| `supabase/migrations/20260609_auth_rls_life_command_center.sql` | Auth/RLS 전환 초안 migration |

이 workpack은 `.ts`, `.tsx`, `.rs` 앱 코드를 직접 덮어쓰지 않는다. Codex가 읽을 수 있는 설계/명령 문서와 안전한 `.md`, `.sql` 초안만 추가한다.
