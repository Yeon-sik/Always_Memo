# Codex Start Here — Yeonsik’s Note Life Command Center

## 1. 현재 판단

Yeonsik’s Note는 이미 단순 메모 앱 단계를 넘어섰다. 현재 제품은 메모, 체크리스트, 운동/식사/체중, 날짜별 기록, Supabase 선택 동기화, Tauri desktop integration을 포함하는 local-first 생활 기록 앱이다.

따라서 다음 목표는 새 기능을 무한히 추가하는 것이 아니라 **V1을 제품처럼 닫는 것**이다.

핵심 부족분은 세 가지다.

1. `기록` 탭의 역할이 아직 조회형 캘린더에 머물러 있다.
2. 운동/식사/체중 기록이 사실상 add-only 루프다.
3. 저장/동기화/날짜 계산을 보호하는 테스트와 보안 경계가 부족하다.

## 2. 반드시 읽을 문서 순서

```text
docs/specs/codex-command-master.md
docs/specs/life-command-center.md
docs/specs/fitness-full-crud-sync.md
docs/specs/native-quick-capture.md
docs/specs/auth-rls-share.md
docs/specs/design-system-luxury-dashboard.md
docs/specs/platform-compatibility.md
docs/plans/codex-implementation-roadmap.md
docs/plans/acceptance-checklist.md
```

## 3. 가장 먼저 할 일

먼저 구현하지 말고 현재 구조를 확인한다.

```powershell
git status --short
Get-ChildItem .\src\features\records
Get-ChildItem .\src\features\fitness
Get-ChildItem .\src\lib\sync
Get-Content .\Version.md -TotalCount 120
```

그 다음 Phase 1만 시작한다.

```text
Phase 1: 기록 탭을 Life Command Center shell로 승격
```

Phase 1은 데이터 구조를 깨지 않고, 새 selector/pure function과 UI shell부터 만든다.

## 4. 절대 금지

- Android/web에서 Tauri API static import로 앱을 깨지 말 것.
- `deletedAt` 없이 hard delete하지 말 것.
- Auth/RLS 전환 중 local-only 모드를 제거하지 말 것.
- `useLocalSyncMemo.ts`를 한 번에 폐기하지 말 것.
- X API secret이나 Supabase service role key를 클라이언트에 넣지 말 것.
