# Personal OS (Yeonsik's Note)

Personal OS는 Tauri v2, React, TypeScript, Vite, Tailwind CSS와 Supabase로 구성한 로컬 우선 개인 기록 앱입니다. 메모, 할 일, 운동·식사·체중 기록은 네트워크나 Supabase 설정이 없어도 로컬에서 먼저 동작하고, 설정과 로그인이 완료되면 같은 계정의 여러 기기 사이에서 동기화됩니다.

이 문서의 기능 설명은 2026-08-01 저장소 소스와 테스트를 기준으로 합니다. 파일 존재나 로컬 빌드가 실제 Windows 설치 환경, 실제 Supabase 프로젝트, 다중 기기 또는 배포 상태를 증명하지는 않습니다. 현재 구조 결정과 검증 경계는 [현재 아키텍처 ADR](docs/adr/2026-08-01-current-architecture.md), 배포 전 확인 사항은 [릴리스 준비 문서](docs/RELEASE_READINESS.md)를 확인하세요.

## 현재 기능

### 기록

- 날짜별 메모, 할 일, 운동, 식사, 체중 기록 조회
- 생산성, 영양, 체중 추이와 월간 캘린더 표시
- 선택한 날짜에서 메모·할 일·운동·식사·체중 빠른 추가
- 운동·식사·체중 soft delete와 제한 시간 내 실행 취소
- 같은 Supabase 프로젝트에 CashOS의 `finance_summary_daily` view가 있을 때 일별 수입·지출 요약 표시

### 메모와 할 일

- 메모 생성, 선택, 제목·본문 수정, soft delete
- 할 일 생성, 내용 수정, 완료 처리, soft delete
- 날짜·시간·계획일 저장과 드래그 순서 변경
- 앱 재실행 후 로컬 데이터 복원

### 운동·식사·체중

- 근력·유산소·기타 운동 기록
- 식사 열량, 단백질, 탄수화물, 지방 기록
- 체중 기록
- 기간별 통계와 Markdown 내보내기
- FitnessApp과 공유하는 Fitness Record Contract v1 호환 필드

### Quick Capture와 데스크톱 통합

- 앱 내부 버튼과 `Ctrl+K` fallback으로 메모 또는 할 일 빠른 입력
- 데스크톱 기본 단축키 `Alt+Space`
- tray 메뉴: Quick Capture, Open, Hide, Quit
- 닫기 요청 시 창 숨김, Windows 시작 시 자동 실행 설정
- 전용 Tauri API가 없는 브라우저 환경에서는 동적 import 실패를 fallback으로 처리

데스크톱 코드는 저장소에 구현되어 있지만 tray, 전역 단축키, 자동 실행, close-to-hide는 설치된 Windows 바이너리에서 별도 수동 smoke가 필요합니다.

## 기술 스택

- Desktop runtime: Tauri v2, Rust
- UI: React 18, TypeScript, Vite
- Styling: Tailwind CSS, lucide-react
- Local persistence: browser `localStorage`를 구현한 `StorageAdapter`
- Remote sync: Supabase Auth, Postgres, Realtime
- Test: Vitest, react-test-renderer
- Windows bundle: NSIS

## 아키텍처

```text
src/main.tsx
  -> App
     -> useLocalSyncMemo                    # App이 사용하는 공개 facade
        -> app/sync/useMemoSyncRuntime      # 설정, hydrate, save, sync, realtime, presence
        -> app/sync/useSnapshotStore        # 단일 snapshot/ref와 commit primitive
        -> features/notes/useNoteActions
        -> features/tasks/useTaskActions
        -> features/fitness/useFitnessRecordActions
     -> RecordsPanel / MemoPanel / ChecklistPanel / FitnessPanel / SettingsPanel
     -> useQuickCapture

syncClientFactory
  -> LocalOnlySyncClient
  -> SupabaseSyncClient                     # 기존 공개 구현
     -> sync/supabase/rows + mappers
     -> sync/supabase/snapshotIo
     -> sync/supabase/realtime
     -> sync/supabase/presence
     -> sync/supabase/financeSummary

src-tauri/src/lib.rs
  -> runtime config와 device persistence command
  -> desktop-only tray, shortcut, autostart, close-to-hide
  -> quick-capture:open event
```

중요한 경계는 다음과 같습니다.

- `useLocalSyncMemo`의 반환 계약은 `App`과 UI가 의존하는 공개 경계입니다.
- 모든 도메인 변경은 공통 `commitSnapshot`을 통해 최신 snapshot ref와 React state를 함께 갱신합니다.
- LWW와 tombstone 병합의 기준 구현은 `src/lib/sync/merge.ts`입니다.
- Supabase row 변환, snapshot 입출력, Realtime, presence, finance query는 각각 별도 모듈이며 `SupabaseSyncClient`가 facade 역할을 합니다.
- `RecordsPanel`, `FitnessPanel`, `ChecklistPanel`, `SettingsPanel`은 조립 책임을 유지하고 세부 UI와 상태 로직은 하위 component/hook으로 분리합니다.
- Rust `lib.rs`의 추가 분리는 Windows native smoke를 수행할 수 있는 변경 단위에서만 진행합니다.

## 주요 디렉터리

```text
src/
  app/
    App.tsx
    useLocalSyncMemo.ts
    sync/
  components/
    settings/
  features/
    command-center/quickActions/
    finance/
    fitness/
    fitness-summary/
    notes/
    quick-capture/
    records/
    tasks/
  lib/
    auth/
    config/
    dataTrust/
    desktop/
    device/
    platform/
    storage/
    sync/
  types/
src-tauri/
  capabilities/
  src/lib.rs
supabase/
  migrations/
  schema.sql
docs/
  adr/
```

## 데이터 모델

로컬 저장의 단위는 `LocalDataSnapshot`입니다.

```text
LocalDataSnapshot
  notes: Note[]
  tasks: Task[]
  workoutRecords: WorkoutRecord[]
  mealRecords: MealRecord[]
  weightRecords: WeightRecord[]
  devices: Device[]
```

동기화 대상 엔티티는 `id`, `createdAt`, `updatedAt`, `deletedAt`, `deviceId`와 누락 보강 메타데이터를 공유합니다. 삭제는 배열에서 row를 제거하는 hard delete가 아니라 `deletedAt`을 기록하는 tombstone입니다. 병합은 `updatedAt`이 최신인 row를 선택하고 timestamp가 같으면 tombstone을 우선합니다.

Fitness 공유 row는 `sourceApp`, `scope`, `metadata`, `contractVersion`을 사용합니다. 자세한 계약은 [Fitness Record Contract v1](docs/FITNESS_RECORD_CONTRACT_V1.md)에 있습니다.

## 저장과 동기화 순서

1. runtime 설정과 로컬 device 정보를 읽습니다.
2. 선택된 sync client에서 Auth 상태를 확인합니다.
3. Auth 상태 확인이 끝나면 `localStorage` snapshot을 불러옵니다.
4. Supabase가 설정되지 않았으면 local-only client를 사용합니다. 설정되어도 인증되지 않았으면 원격 작업을 중단하고 로컬 snapshot을 유지합니다.
5. 인증된 경우 원격 snapshot을 pull하고 로컬 snapshot과 병합합니다.
6. 사용자 변경은 React state에 먼저 반영하고 debounce 후 로컬 저장과 remote push를 수행합니다.
7. Realtime 변경은 현재 snapshot에 병합하고 구독 해제 시 listener를 정리합니다.
8. heartbeat와 active-device 갱신은 인증된 Supabase mode에서만 동작합니다.

hydrate가 끝난 뒤 발생한 pull/push 오류는 편집 자체를 직접 막지 않으며 동기화 오류를 UI에 표시합니다. 다만 현재 Auth session 초기화가 `storage.load()`보다 먼저 실행되므로 session 조회 자체가 예외를 던지는 시작 경로에서는 기존 local snapshot 복구를 보장하지 못합니다. 이 데이터 보존 위험과 회귀 테스트는 [GitHub issue #31](https://github.com/Yeon-sik/Always_Memo/issues/31)에서 추적합니다.

## Supabase 설정

Supabase를 사용하지 않으면 별도 설정 없이 local-only mode로 실행할 수 있습니다.

공통 Supabase를 사용하는 배포본은 빌드 환경에 Project URL과
anon/publishable key를 제공합니다.

```env
VITE_SUPABASE_URL=https://YOUR_PROJECT_REF.supabase.co
VITE_SUPABASE_ANON_KEY=YOUR_ANON_OR_PUBLISHABLE_KEY
```

완전한 빌드 설정이 있으면 앱이 해당 연결을 우선하며, 이전에 저장한 수동
URL/key가 이를 덮어쓰지 않습니다. 사용자는 각 기기에서 이메일과 비밀번호로
최초 한 번 로그인하고 이후에는 Supabase가 저장한 세션을 사용합니다.

빌드 설정이 없을 때는 다음 순서로 fallback합니다.

1. Tauri runtime env 파일의 연결 정보
2. 앱 설정 화면에서 로컬로 저장한 수동 연결 정보

Tauri runtime env 파일은 다음 키를 읽습니다.

```env
SUPABASE_URL=https://YOUR_PROJECT_REF.supabase.co
SUPABASE_ANON_KEY=YOUR_ANON_OR_PUBLISHABLE_KEY
```

`VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`도 runtime env 파일에서 읽을 수
있습니다. 수동 `USER_ID`는 지원하지 않습니다. row의 `user_id`는 인증 세션의
`auth.users.id`를 문자열로 저장합니다.

Tauri runtime env 탐색 순서는 다음과 같습니다.

1. `YEONSIK_NOTE_ENV`가 가리키는 파일
2. 앱 설정 폴더의 `.env`
3. 앱 설정 폴더의 `yeonsik-note.env`
4. 실행 파일 폴더의 `.env`
5. 실행 파일 폴더의 `yeonsik-note.env`
6. 현재 작업 폴더의 `.env`

동일 로컬 데이터는 최초 연결된 Auth 계정에 binding되며, 다른 계정으로 자동
전환하지 않습니다. 저장된 binding은 URL과 key가 현재 관리형 연결과 정확히
일치할 때만 승계합니다.

DB 변경 절차, migration 순서와 RLS 검증은 [Supabase 운영 문서](supabase/README.codex.md)를 따르세요. `supabase/schema.sql`은 현재 개발 스키마 snapshot이고 `supabase/migrations/*.sql`이 변경 이력의 기준입니다. 저장소에 migration이 있다는 사실만으로 특정 원격 프로젝트에 적용되었다고 판단하면 안 됩니다.

## Supabase와 저장소 간 계약

Personal OS가 직접 동기화하는 테이블은 다음과 같습니다.

- `devices`
- `notes`
- `tasks`
- `workout_records`
- `meal_records`
- `weight_records`

`workout_exercises`와 `workout_sets`는 같은 Fitness contract에 포함되지만 FitnessApp이 상세 row를 소유합니다. Personal OS는 compact parent summary를 사용합니다.

CashOS 일별 요약은 이 저장소가 생성하지 않는 외부 계약입니다. 같은 Supabase 프로젝트에 `finance_summary_daily(date, user_id, income_krw, expense_krw, net_krw, entry_count)` view와 해당 사용자 접근 정책이 있을 때만 기록 화면에 표시됩니다.

## 보안 경계

- `.env`, Supabase session, 로컬 설정, 빌드 산출물은 Git에 커밋하지 않습니다.
- anon/publishable key는 공개 클라이언트 식별자이며 사용자 권한을 대신하지 않습니다.
- service-role key나 secret key를 클라이언트에 넣지 않습니다.
- repository schema와 `20260724121000_enable_authenticated_rls.sql`은 anon 접근을 회수하고 `auth.uid()::text = user_id` 소유자 정책을 정의합니다.
- 기존 DB의 legacy owner가 실제 `auth.users.id`에 매핑되지 않으면 RLS migration은 중단하도록 설계되어 있습니다.
- 운영 적용 여부와 cross-account 차단은 대상 Supabase 프로젝트에서 별도로 검증해야 합니다.
- `localStorage`는 OS 보안 저장소가 아닙니다. 민감한 개인 데이터가 있는 장기 운영에서는 별도 저장소 전환과 데이터 삭제 절차가 필요합니다.

## 개발과 검증

의존성 설치:

```powershell
npm.cmd install
```

웹 개발 서버와 Tauri 개발 실행:

```powershell
npm.cmd run dev
npm.cmd run tauri:dev
```

변경 전후 기본 검증:

```powershell
npm.cmd run typecheck
npm.cmd test
npm.cmd run build
```

Windows native 또는 release 관련 변경 시:

```powershell
npm.cmd run tauri:build
npm.cmd run release:verify-windows
```

빌드가 `failed to remove file` 또는 `os error 5`로 실패하면 실행 중인 앱과 tray 프로세스가 산출물을 잠그고 있는지 먼저 확인합니다.

## 빌드 산출물

버전은 `package.json`과 `src-tauri/tauri.conf.json`의 `1.0.0`을 기준으로 합니다.

```text
src-tauri/target/release/Yeonsik_Note.exe
src-tauri/target/release/bundle/nsis/Yeonsik_Note_1.0.0_x64-setup.exe
```

파일명은 번들러 환경에 따라 달라질 수 있으므로 release 검증 script로 실제 산출물을 확인합니다. `dist`, `src-tauri/target`, 설치 파일은 소스 저장소에 커밋하지 않습니다.

## 문서 관리

- 현재 구조와 결정: [docs/adr/2026-08-01-current-architecture.md](docs/adr/2026-08-01-current-architecture.md)
- DB 운영: [supabase/README.codex.md](supabase/README.codex.md)
- Fitness 공유 계약: [docs/FITNESS_RECORD_CONTRACT_V1.md](docs/FITNESS_RECORD_CONTRACT_V1.md)
- 배포 gate: [docs/RELEASE_READINESS.md](docs/RELEASE_READINESS.md)
- 외부 소개 문서: `docs/Project_Intro.md`, `docs/Project_Detail.md`

Git Markdown가 문서 원본이고 Notion은 생성 mirror입니다. 완료된 prompt, handoff, 상태 snapshot은 active tree에 계속 쌓지 않습니다. 아직 끝나지 않은 작업은 GitHub issue, 지속되는 결정은 ADR, 동작 보장은 test/CI가 소유합니다.

## 유지보수 원칙

- 기존 facade와 public import path를 보존한 채 작은 seam부터 분리합니다.
- 로컬 저장 성공과 원격 동기화 성공을 같은 증거로 취급하지 않습니다.
- 데이터 모델 변경 시 local snapshot normalize, Supabase row mapper, schema/migration, Realtime 적용을 함께 검토합니다.
- hard delete 대신 tombstone을 유지하고 LWW 규칙을 한 곳에서 관리합니다.
- Tauri native 구조 변경은 Windows tray·shortcut·autostart smoke를 수행할 수 있을 때 진행합니다.
- cache, generated output, secret, 개인 학습 자료를 제품 source와 섞지 않습니다.
