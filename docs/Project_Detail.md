# Personal OS | Project Detail

> 이 문서는 Personal OS의 로컬 우선 상태 관리, 기능별 UI, Supabase 동기화, Tauri desktop 경계와 FitnessApp·CashOS 요약 계약을 설명하고 검증된 범위와 남은 배포 gate를 분리한다.

| 항목 | 내용 |
| --- | --- |
| 문서 상태 | Active |
| 최종 갱신 | 2026-08-01 |
| 기준 커밋 | `dc45172f965528aa66d375d30a4ac781c9f9c6de` |
| 코드 증거 | source, schema·migration, 20 test files/82 tests, local build |
| runtime 증거 | 로컬 브라우저 핵심 CRUD·reload·fallback smoke |
| 미검증 환경 | 설치된 Windows 앱, 실제 Supabase·다중 기기·교차 앱, 서명된 installer |
| 진실 원천 | Git Markdown, source/test, timestamped migration, 명시한 runtime 절차 |

## 1. 문서 목적과 범위

### 포함

- 메모·할 일·Quick Capture·기록 캘린더
- 운동·식사·체중 기록과 Fitness Record Contract v1
- CashOS 일별 금융 요약의 read-only 조회 경계
- localStorage 기반 persistence와 Supabase Auth/pull/push/Realtime
- `useLocalSyncMemo`와 `SupabaseSyncClient` 내부 책임 분리
- Records·Fitness·Checklist·Settings UI facade 분리
- Tauri tray·global shortcut·autostart·close-to-hide와 NSIS build
- local type/test/build, 브라우저 smoke와 남은 release gate

### 제외

- FitnessApp의 상세 운동 종목·세트 구현
- CashOS의 원장, 투자/FIFO 계산과 summary view 생성
- 실제 Supabase 프로젝트에 migration/RLS가 적용됐다는 주장
- 설치된 Windows 앱의 native 기능·installer 동작 주장
- Authenticode 서명, 자동 업데이트, store 배포 완료 주장
- 아직 구현되지 않은 Fitness edit UI, Life Report 공유, OAuth 완료 주장

모든 코드 설명의 primary source boundary는 commit `dc45172f965528aa66d375d30a4ac781c9f9c6de`이다. 2026-08-01 로컬 브라우저 smoke와 local command 결과는 별도 runtime/build 증거로 구분한다.

## 2. 시스템 아키텍처

```text
Tauri desktop shell
  -> runtime config / persisted device commands
  -> tray / global shortcut / autostart / close-to-hide
  -> quick-capture:open event

React App
  -> useLocalSyncMemo                         public facade
     -> useMemoSyncRuntime                    config, Auth, hydrate, save, sync, presence
        -> useSnapshotStore                   snapshot state/ref + commitSnapshot
     -> useNoteActions
     -> useTaskActions
     -> useFitnessRecordActions
  -> RecordsPanel / FitnessPanel
  -> MemoPanel / ChecklistPanel / SettingsPanel
  -> useQuickCapture

syncClientFactory
  -> LocalOnlySyncClient
  -> SupabaseSyncClient                       public facade
     -> supabase/rows + mappers
     -> supabase/snapshotMerge + snapshotIo
     -> supabase/realtime
     -> supabase/presence
     -> supabase/financeSummary
```

### 상태와 action 경계

`App`은 `useLocalSyncMemo`의 반환 contract를 그대로 사용한다. facade는 visible entity와 action을 조립하고 실제 orchestration은 `useMemoSyncRuntime`, 변경은 domain action hook이 소유한다.

`useSnapshotStore`는 React state와 최신 snapshot ref를 함께 관리한다. note, task, fitness hook이 각자 snapshot copy를 소유하지 않고 공통 `commitSnapshot`에 updater를 전달하므로 연속 action에서 stale closure로 update가 사라질 가능성을 줄인다.

### UI 경계

| Facade | 추출된 책임 | 유지하는 public 경계 |
| --- | --- | --- |
| `RecordsPanel` | overview, finance card, selected-date list, chart interaction, delete undo | 기존 props, DOM·handler 흐름 |
| `FitnessPanel` | workout/meal/weight form, workout draft validation·hook | record create contract |
| `ChecklistPanel` | draft form, task list/row, reorder helper | task action props |
| `SettingsPanel` | appearance, Supabase/Auth, desktop integration, active devices | 설정 action props |

화면은 조립을 담당하고 계산은 `recordAggregation`, `fitnessStats`, `financeCalendar`, draft/reorder helper 같은 pure module이 담당한다.

### Supabase 경계

`SupabaseSyncClient`는 기존 `SyncClient` 구현과 import path를 유지한다. DB row type, snake_case/camelCase mapper, snapshot pull/push, Realtime event, presence와 finance summary query는 하위 module로 분리됐다. LWW와 tombstone 선택 규칙은 `src/lib/sync/merge.ts`를 canonical helper로 사용한다.

## 3. 데이터 모델과 불변식

로컬 persistence 단위는 하나의 `LocalDataSnapshot`이다.

```text
LocalDataSnapshot
  notes
  tasks
  workoutRecords
  mealRecords
  weightRecords
  devices
```

| 데이터 | 소유 경계 | 원격 계약 |
| --- | --- | --- |
| notes, tasks, devices | Personal OS | Auth 사용자별 table |
| workout parent summary | Personal OS·FitnessApp 공통 | `workout_records`, contract v1 |
| workout exercises, sets | FitnessApp | Personal OS는 상세 수정하지 않음 |
| meal, weight | 공통 fitness 기록 | scope/source metadata 포함 |
| finance daily summary | CashOS | Personal OS는 view를 read-only 조회 |

핵심 불변식:

1. 입력은 네트워크 응답보다 먼저 local snapshot에 반영한다.
2. syncable entity는 `createdAt`, `updatedAt`, `deletedAt`, `deviceId`와 backfill metadata를 유지한다.
3. 삭제는 hard delete가 아닌 tombstone이다.
4. `updatedAt`이 최신인 row가 이기고 같은 timestamp에서는 tombstone을 우선한다.
5. Auth account가 다르면 기존 local data를 새 사용자에게 자동 binding하지 않는다.
6. Fitness detail과 CashOS 원장 계산을 Personal OS 안에서 중복 구현하지 않는다.
7. service-role key와 임의 `USER_ID`는 client authorization으로 사용하지 않는다.

## 4. 핵심 기술 의사결정

### 결정 1. public facade를 유지한 점진적 분리

- **상황**: App이 사용하는 거대 hook과 sync client를 한 번에 교체하면 회귀 범위가 커진다.
- **선택**: `useLocalSyncMemo`, `SupabaseSyncClient`는 facade로 남기고 내부 seam부터 추출한다.
- **결과**: App과 기존 import contract를 유지하면서 테스트 가능한 경계가 생겼다.
- **비용**: facade 조립 코드와 module 수는 늘어난다.

### 결정 2. 공통 snapshot commit primitive

- **상황**: 여러 domain hook이 같은 snapshot을 수정하면 stale closure와 lost update가 발생할 수 있다.
- **선택**: state와 ref를 함께 갱신하는 `commitSnapshot` 하나를 주입한다.
- **결과**: note, task, fitness action의 mutation 순서가 하나의 상태 경계를 통과한다.
- **비용**: domain action은 store contract에 의존한다.

### 결정 3. local-first와 remote sync 분리

- **상황**: 네트워크 부재 또는 Supabase 미설정 상태가 개인 기록 입력을 막으면 안 된다.
- **선택**: storage adapter, local-only client, Supabase client를 분리한다.
- **결과**: local-only mode와 hydrate 이후의 원격 pull/push 실패는 local CRUD를 직접 차단하지 않는다.
- **비용**: merge, retry, tombstone, 계정 binding을 명시적으로 관리해야 한다.
- **남은 위험**: Auth session 조회 예외가 local hydrate보다 먼저 발생하는 경로는 [#31](https://github.com/Yeon-sik/Always_Memo/issues/31)에서 수정한다.

### 결정 4. 도메인 앱은 요약 계약으로 연결

- **상황**: FitnessApp 상세 schema와 CashOS 원장 schema에 직접 결합하면 각 앱의 변경이 Personal OS에 전파된다.
- **선택**: Fitness parent summary와 `finance_summary_daily` view만 소비한다.
- **결과**: Personal OS는 하루 요약·판단, 각 도메인 앱은 상세 입력·계산을 소유한다.
- **비용**: end-to-end 신뢰성은 여러 저장소와 실제 Supabase를 함께 검증해야 한다.

### 결정 5. native Rust 분리는 runtime smoke 이후

- **상황**: `src-tauri/src/lib.rs`는 여러 native 책임을 가지지만 정적 분리는 tray·shortcut 동작을 바꿀 수 있다.
- **선택**: repository cleanup에서는 Rust 동작을 유지하고 설치된 Windows smoke가 가능한 별도 작업으로 남긴다.
- **결과**: native 변경 위험을 문서·UI refactor와 분리했다.
- **비용**: Rust 한 파일의 책임 집중은 당분간 남는다.

## 5. 동기화와 데이터 흐름

```text
startup
  -> runtime config와 device 읽기
  -> Auth state와 local account binding 확인
  -> local snapshot hydrate
  -> 가능한 경우 remote pull + merge
  -> Realtime subscribe + heartbeat

mutation
  -> domain action
  -> commitSnapshot
  -> debounce local save
  -> authenticated/online이면 push

remote event
  -> row mapper
  -> canonical LWW/tombstone merge
  -> snapshot replace
  -> local save

manual sync
  -> 현재 snapshot 기준 remote pull
  -> pulled snapshot remote push
  -> pulled snapshot local save와 state replace
```

active-device 조회는 manual sync 내부가 아니라 준비된 runtime의 별도 주기 effect가 담당한다. 구독 종료 시 Realtime과 heartbeat listener를 정리한다. 이 흐름은 characterization와 module test로 보호되지만 실제 두 기기 수렴은 [#27](https://github.com/Yeon-sik/Always_Memo/issues/27)의 runtime 검증 대상이다. Auth state 조회 예외가 local hydrate보다 먼저 발생하는 경로는 [#31](https://github.com/Yeon-sik/Always_Memo/issues/31)의 데이터 보존 검증 대상이다.

## 6. 외부 연동과 실패 경계

| 대상 | 목적 | 실패 시 동작 | 현재 증거 |
| --- | --- | --- | --- |
| Supabase Auth | session·owner·local account binding | 정상적인 미인증 상태는 local mode 유지. session 조회 예외 복구는 #31 | source·tests, 실제 provider 미검증 |
| Supabase Postgres | snapshot pull/push | local snapshot 유지, sync error 표시 | mapper/I/O tests, 실제 DB 미검증 |
| Supabase Realtime | 다른 client 변경 반영 | subscription error와 다음 pull 경로 | event tests, 실제 다중 기기 미검증 |
| Device presence | heartbeat·active device | local device fallback | presence tests, provider 미검증 |
| FitnessApp | 완료 운동 parent summary | 상세 row는 FitnessApp에 유지 | contract 존재, 실제 교차 앱 미검증 |
| CashOS | 일별 수입·지출·순액·건수 | finance card 오류 또는 빈 상태 | query/mapper test, 동일 fixture 미검증 |
| Tauri desktop | tray·shortcut·autostart·config | browser dynamic-import fallback | build 통과, 설치 runtime 미검증 |

CashOS finance query는 `finance_summary_daily`의 날짜 범위와 현재 Auth 사용자만 조회한다. `security_invoker = true` view와 계산, 기반 table의 사용자 RLS, anon 권한 회수·authenticated `SELECT` grant는 CashOS migration이 소유하며 Personal OS schema가 만들지 않는다.

## 7. 데이터 보호와 보안

- Supabase URL과 anon/publishable key는 authorization이 아니며 RLS가 사용자 데이터 경계다.
- service-role key 또는 secret key를 client에 포함하지 않는다.
- repository schema와 RLS migration은 anon table 권한을 회수하고 `auth.uid()::text = user_id` owner policy를 정의한다.
- legacy owner가 실제 `auth.users.id`에 대응하지 않으면 RLS migration이 중단되도록 구성돼 있다.
- Tauri CSP는 self를 기본으로 하고 필요한 HTTPS/WSS 연결만 허용한다.
- localStorage는 OS secure storage가 아니므로 장기 persistence·archive는 [#29](https://github.com/Yeon-sik/Always_Memo/issues/29)에서 결정한다.
- SQL과 policy 존재는 실제 운영 적용 증거가 아니다. 두 계정 격리와 unauthenticated 차단은 [#27](https://github.com/Yeon-sik/Always_Memo/issues/27)에서 검증한다.

## 8. 테스트와 검증 전략

### 자동화·빌드 증거

기준: commit `dc45172f965528aa66d375d30a4ac781c9f9c6de`, 2026-08-01 Windows 개발 환경.

| 명령·계층 | 대상 | 결과 |
| --- | --- | --- |
| `npm.cmd run typecheck` | TypeScript 전체 | 통과 |
| `npm.cmd test` | hook runtime, storage, domain service, selector, reorder/draft, Supabase mapper·I/O·Realtime·presence·finance | Vitest 20 files, 82 tests 통과 |
| `npm.cmd run build` | TypeScript compile + Vite production bundle | 통과. main bundle 549.83 kB, 기존 chunk-size warning |
| `npm.cmd run tauri:build` | Rust release, Tauri executable, NSIS bundle | 통과 |
| `npm.cmd run release:verify-windows` | version, artifact, Authenticode | 실패. 서명 상태 `NotSigned` |

`NotSigned` 때문에 release 검증 전체는 실패다. NSIS 생성과 배포 준비 완료를 같은 결과로 합치지 않는다.

### 로컬 브라우저 runtime smoke

| 흐름 | 관찰 결과 |
| --- | --- |
| 메모 | 생성·조회·수정·삭제 후 reload persistence 확인 |
| 할 일 | 생성·수정·완료 toggle·삭제 확인 |
| 운동·식사·체중 | 각 record 생성, dashboard 반영, 삭제 확인 |
| 운동 undo | 삭제 후 undo로 복원 확인 |
| Settings | 화면 진입과 주요 설정 영역 렌더 확인 |
| Quick Capture | Tauri API가 없는 browser fallback 열기·입력 흐름 확인 |

이 smoke는 local browser UI 증거다. tray event, `Alt+Space`, autostart와 close-to-hide를 실행하지 않았으므로 Windows desktop runtime 증거로 확장하지 않는다.

### 지속 검증

`.github/workflows/app-quality.yml`은 pull request와 `main` push에서 Ubuntu·Node 22 환경으로 다음 순서를 실행한다.

```text
npm ci
  -> npm run typecheck
  -> npm test
  -> npm run build
```

workflow 구성은 repository evidence다. 특정 remote run이 성공했다는 주장은 해당 GitHub Actions 결과를 별도로 확인해야 한다.

## 9. 배포·운영·복구

```text
reviewed branch
  -> typecheck + 82 tests + Vite build
  -> Tauri release + NSIS build
  -> Authenticode signing + release verification
  -> installed Windows smoke
  -> Supabase backup + migration/RLS staging verification
  -> two-account + two-device + cross-app smoke
  -> staged release
```

- Windows artifact는 생성됐지만 `NotSigned`이므로 배포 승인 상태가 아니다.
- 설치·제거, tray, shortcut, autostart와 close-to-hide는 [#26](https://github.com/Yeon-sik/Always_Memo/issues/26)에서 설치 바이너리로 검증한다.
- DB 변경은 backup, timestamped migration, legacy owner 확인 후 진행하며 실패한 owner guard를 우회하지 않는다.
- 실제 RLS·Realtime·cross-device·FitnessApp/CashOS 계약은 [#27](https://github.com/Yeon-sik/Always_Memo/issues/27)에서 검증한다.
- hydrate 이후 원격 pull/push 장애에서는 local snapshot을 유지하고, 복구 후 같은 revision과 account로 동기화를 재실행한다. 시작 시 Auth 조회 예외 경로는 #31 해결 전 같은 보장을 하지 않는다.
- Git Markdown가 문서 원본이다. `main`의 검토된 변경만 설정된 Notion mirror workflow 대상이며, 이 로컬 작업은 render-only 검증만 수행한다.

## 10. 한계, 기술 부채, 다음 단계

| 우선순위 | 항목 | 현재 영향 | 다음 행동 |
| --- | --- | --- | --- |
| P0 | Windows installed-runtime·서명 미검증 | native 동작과 배포 신뢰성을 증명할 수 없음 | [#26](https://github.com/Yeon-sik/Always_Memo/issues/26) |
| P0 | 실제 Supabase·cross-device·CashOS fixture 미검증 | 보안·수렴·요약 정확성을 운영 증거로 주장할 수 없음 | [#27](https://github.com/Yeon-sik/Always_Memo/issues/27) |
| P0 | Auth session 초기화 예외가 local load보다 먼저 발생 | 기존 local snapshot 복구 실패 또는 빈 snapshot 저장 위험 | [#31](https://github.com/Yeon-sik/Always_Memo/issues/31) |
| P1 | Fitness edit UI·Life Report 공유 미완료 | 입력 후 수정과 외부 공유 흐름이 닫히지 않음 | [#28](https://github.com/Yeon-sik/Always_Memo/issues/28) |
| P1 | localStorage 장기 persistence·archive 미결정 | 데이터 증가와 완료 기록 관리 전략이 불명확 | [#29](https://github.com/Yeon-sik/Always_Memo/issues/29) |
| P2 | OAuth 미구현 | email/password 외 로그인 선택지가 없음 | [#30](https://github.com/Yeon-sik/Always_Memo/issues/30) |
| P2 | Rust `lib.rs` 책임 집중 | native 변경 review 범위가 큼 | #26 smoke를 확보한 뒤 runtime config/desktop module 분리 |
| P2 | main bundle 549.83 kB | 초기 로딩 비용 가능성 | 측정 후 필요한 route/feature만 lazy split |

우선순위는 기능 추가보다 증거 확보가 먼저다. [#26](https://github.com/Yeon-sik/Always_Memo/issues/26)으로 Windows runtime을 검증하고, [#27](https://github.com/Yeon-sik/Always_Memo/issues/27)로 보안·다중 기기·교차 앱 계약을 확인한 뒤 edit/share와 persistence 확장을 진행한다.

## 11. 관련 문서

- [Project Intro](./Project_Intro.md)
- [Current Architecture ADR](./adr/2026-08-01-current-architecture.md)
- [Fitness Record Contract v1](./FITNESS_RECORD_CONTRACT_V1.md)
- [Release Readiness](./RELEASE_READINESS.md)
- [README](../README.md)
