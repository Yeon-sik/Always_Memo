# ADR: 2026-08-01 Personal OS 현재 아키텍처

- Status: Accepted
- Date: 2026-08-01
- Repository evidence boundary: `agent/personal-os-maintenance`, implementation and CI baseline commit `dc45172f965528aa66d375d30a4ac781c9f9c6de`; this ADR is part of the final documentation commit
- Scope: PersonalOSApp의 frontend, local persistence, Supabase sync, Tauri desktop 경계와 cross-repository contract

## Context

Personal OS는 메모와 할 일 중심 앱에서 날짜별 기록, 운동·식사·체중, Quick Capture, Supabase Auth/Realtime, CashOS finance summary와 FitnessApp 상세 운동 contract까지 포함하는 앱으로 확장되었습니다.

기능 확장 과정에서 다음 파일이 서로 다른 책임을 함께 소유했습니다.

- `useLocalSyncMemo.ts`: runtime config, hydrate, local save, pull/push, Realtime, heartbeat와 모든 domain action
- `supabaseSyncClient.ts`: DB row type/mapper, snapshot I/O, Realtime, presence, finance query
- `RecordsPanel.tsx`, `FitnessPanel.tsx`, `ChecklistPanel.tsx`, `SettingsPanel.tsx`: 화면 조립, 입력 상태, 계산과 세부 UI

동시에 오래된 실행 prompt와 handoff 문서가 현재 구현보다 앞선 계획 또는 과거 상태를 active tree에서 설명하고 있었습니다. 유지보수 비용을 줄이려면 public contract는 유지하되 내부 책임, 운영 문서와 검증 증거의 소유자를 명확히 해야 합니다.

## Decision

### 1. App은 facade에만 의존한다

`App.tsx`는 계속 `useLocalSyncMemo` 하나를 소비합니다. `useLocalSyncMemo`의 반환 shape는 UI의 공개 contract로 유지하고 내부 책임은 다음과 같이 나눕니다.

```text
useLocalSyncMemo
  -> useMemoSyncRuntime
     -> useSnapshotStore
  -> useNoteActions
  -> useTaskActions
  -> useFitnessRecordActions
```

| Module | 책임 |
| --- | --- |
| `useLocalSyncMemo.ts` | visible entity와 action을 조립하는 얇은 facade |
| `app/sync/useMemoSyncRuntime.ts` | config, Auth state, hydrate, debounce save, pull/push, Realtime, heartbeat, active device와 autostart |
| `app/sync/useSnapshotStore.ts` | 최신 snapshot ref, React state와 공통 `commitSnapshot` |
| domain action hook | note, task, fitness mutation과 해당 domain invariant |

여러 hook이 각자 snapshot state를 소유하지 않습니다. 모든 mutation은 공통 `commitSnapshot`을 사용해 stale closure와 lost update 위험을 줄입니다.

### 2. local-first와 sync contract를 유지한다

로컬 저장 단위는 다음 `LocalDataSnapshot`입니다.

```text
notes
tasks
workoutRecords
mealRecords
weightRecords
devices
```

원칙:

- Supabase 미설정 local-only mode와 인증되지 않은 정상 상태에서는 로컬 편집을 유지합니다.
- 현재 시작 순서는 Auth 상태 확인 후 local snapshot을 읽고, 인증 가능한 경우 원격 snapshot과 병합합니다.
- Auth session 조회 자체가 예외를 던지면 local snapshot load 전 fallback으로 진입하는 데이터 보존 위험이 남아 있으며 [GitHub issue #31](https://github.com/Yeon-sik/Always_Memo/issues/31)에서 별도 수정합니다.
- mutation은 UI state에 먼저 반영하고 debounce 후 local save와 remote push를 시도합니다.
- 모든 syncable entity는 `createdAt`, `updatedAt`, `deletedAt`, `deviceId`와 backfill metadata를 가집니다.
- 삭제는 tombstone이며 hard delete로 대체하지 않습니다.
- LWW 규칙과 동일 timestamp tombstone 우선 규칙의 canonical 구현은 `src/lib/sync/merge.ts`입니다.

### 3. Supabase client는 facade로 유지한다

기존 import와 `SyncClient` 구현 contract를 보존하면서 내부를 다음 seam으로 분리합니다.

```text
src/lib/sync/supabase/
  rows.ts
  mappers.ts
  snapshotMerge.ts
  snapshotIo.ts
  realtime.ts
  presence.ts
  financeSummary.ts
```

- `rows.ts`: DB row와 transport type boundary
- `mappers.ts`: snake_case DB row와 camelCase entity 변환
- `snapshotMerge.ts`: canonical merge helper를 사용한 snapshot 병합
- `snapshotIo.ts`: table pull/push
- `realtime.ts`: change event를 snapshot에 적용하고 subscription을 정리
- `presence.ts`: device heartbeat와 active-device 조회
- `financeSummary.ts`: 외부 CashOS summary view의 read-only query

`supabaseSyncClient.ts`는 Auth session과 이 모듈들을 조립하는 facade만 소유합니다. mapper나 merge 규칙을 facade 안에 다시 복사하지 않습니다.

### 4. 화면 facade와 세부 UI를 분리한다

화면의 public props, DOM 순서, 접근성 label과 handler 순서는 유지합니다.

| Facade | 하위 경계 |
| --- | --- |
| `RecordsPanel` | overview, finance day card, selected-date list, chart interaction, fitness delete undo |
| `FitnessPanel` | workout/meal/weight form, workout draft hook와 pure draft validation |
| `ChecklistPanel` | task draft form, list, row와 pure reorder helper |
| `SettingsPanel` | appearance, Supabase/Auth, desktop integration, active devices |

계산은 기존 `recordAggregation.ts`, `fitnessStats.ts`, `financeCalendar.ts` 같은 pure module을 사용합니다. JSX 안에 같은 계산을 다시 구현하지 않습니다.

### 5. desktop-native 경계는 검증 가능할 때만 이동한다

Tauri command와 desktop integration은 현재 `src-tauri/src/lib.rs`에 있습니다.

- runtime config와 persisted device command
- `#[cfg(desktop)]` tray, global shortcut, autostart
- close-to-hide
- `quick-capture:open` event

Rust를 `runtime_config.rs`, `desktop.rs`로 나누는 것은 바람직하지만, Windows tray의 Quick Capture/Open/Hide/Quit, global shortcut, autostart와 close-to-hide를 설치 바이너리에서 smoke할 수 있는 변경 단위까지 보류합니다. 정적 import가 mobile/browser path를 깨지 않도록 TypeScript Tauri API는 dynamic import와 fallback을 유지합니다.

### 6. Auth/RLS와 원격 적용을 구분한다

Repository contract:

- 수동 `USER_ID`는 제거되었습니다.
- Supabase Auth session의 `auth.users.id`가 row owner입니다.
- 로컬 데이터는 처음 연결한 Auth account에 binding됩니다.
- `schema.sql`과 `20260724121000_enable_authenticated_rls.sql`은 anon table 권한 회수와 `auth.uid()::text = user_id` CRUD policy를 정의합니다.
- legacy owner가 실제 Auth user에 연결되지 않으면 RLS migration은 중단합니다.

이 SQL의 존재는 실제 Supabase project 적용 증거가 아닙니다. Production 완료 판정에는 backup, migration history, two-account cross-access, unauthenticated denial, Realtime과 tombstone runtime 검증이 필요합니다.

### 7. cross-repository contract의 소유자를 고정한다

Fitness:

- `workout_records`는 Personal OS가 읽는 compact parent입니다.
- `workout_exercises`, `workout_sets`는 FitnessApp이 소유하는 detail입니다.
- contract version과 scope 규칙은 `docs/FITNESS_RECORD_CONTRACT_V1.md`가 소유합니다.

Finance:

- `finance_summary_daily` view와 계산은 CashOS migration이 소유합니다.
- Personal OS는 동일 Supabase project와 Auth user의 date-range summary를 read-only로 조회합니다.
- Personal OS schema는 이 view를 만들거나 수정하지 않습니다.

### 8. 문서의 소유자를 단순화한다

```text
현재 사용법과 진입점 -> README
지속되는 구조 결정 -> ADR
DB 변경과 적용 절차 -> supabase/README.codex.md + timestamped migration
도메인 계약 -> active spec/contract
미완료 작업 -> GitHub issue
동작 증거 -> test/CI/runtime verification record
외부 소개 -> Project_Intro.md / Project_Detail.md
```

완료된 prompt, handoff와 상태 snapshot은 유효한 규칙을 위 문서로 옮긴 뒤 삭제합니다. 미완료 acceptance가 남은 문서는 issue로 이전하기 전 삭제하지 않습니다. Git Markdown가 canonical source이고 Notion은 generated mirror입니다.

## Consequences

### Positive

- App과 기존 UI의 공개 contract를 유지하면서 변경 영향 범위를 좁힙니다.
- sync mapper, I/O, Realtime, presence와 finance query를 독립적으로 검증할 수 있습니다.
- snapshot 변경 primitive가 하나여서 domain hook 사이의 update 유실 위험이 줄어듭니다.
- 화면 조립과 세부 UI의 책임이 나뉘어 작은 review가 가능합니다.
- repository 구현, 실제 Supabase 적용과 Windows runtime 증거를 구분합니다.
- 현재 문서와 과거 실행 지시가 충돌하는 문제를 줄입니다.

### Trade-offs

- facade를 유지하므로 내부 module 수가 늘고 조립 코드가 남습니다.
- localStorage는 여전히 장기 저장과 OS-level 보안에 한계가 있습니다.
- LWW는 동시에 편집한 의미 충돌을 설명하거나 복구하지 않습니다.
- Rust는 아직 한 파일에 여러 native 책임이 남아 있습니다.
- CashOS finance view와 FitnessApp detail은 이 저장소만으로 end-to-end 검증할 수 없습니다.
- Auth 초기화 예외보다 local hydrate가 늦어지는 현재 순서는 local-first 복구 보장을 약화하며 별도 회귀 수정이 필요합니다.

## Verification boundary

이 ADR은 source, test file, schema와 migration을 확인한 repository evidence입니다. 최종 maintenance 변경은 최소한 다음 명령을 통과해야 합니다.

```powershell
npm.cmd run typecheck
npm.cmd test
npm.cmd run build
node .github/project-docs/validate-project-docs.mjs --config project-docs.config.json --require-tracked
node .github/project-docs/sync-project-docs-to-notion.mjs --config project-docs.config.json
```

두 번째 문서 명령은 `--apply` 없는 render-only dry run입니다.

2026-08-01 유지보수 변경에서 확인한 결과:

- TypeScript typecheck 통과
- Vitest 20개 파일, 82개 테스트 통과
- Vite production build 통과(main bundle 약 549.83 kB, 기존 chunk size warning 유지)
- Tauri release executable과 NSIS installer build 통과
- 로컬 브라우저에서 note/task/fitness record CRUD, reload persistence, workout delete undo, Settings와 Quick Capture browser fallback smoke 통과
- Windows release trust verifier는 `NotSigned`로 실패했으므로 배포 가능 상태로 판정하지 않음

다음은 이 ADR 작성으로 검증되지 않았습니다.

- 설치된 Windows 앱의 tray, shortcut, autostart, close-to-hide와 installer 동작([GitHub issue #26](https://github.com/Yeon-sik/Always_Memo/issues/26))
- 실제 두 기기의 pull, push, Realtime과 tombstone 수렴
- 실제 Supabase project의 migration/RLS 적용과 CashOS 동일 fixture finance 결과([GitHub issue #27](https://github.com/Yeon-sik/Always_Memo/issues/27))
- Supabase Auth 초기화 예외에서 기존 local snapshot 보존([GitHub issue #31](https://github.com/Yeon-sik/Always_Memo/issues/31))
- Notion page의 실제 publication 결과
