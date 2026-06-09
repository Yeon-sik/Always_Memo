# Yeonsik's Note 프로젝트 총 정리

작성일: 2026-06-09  
작성 위치: `C:\Github\메모\MemoNote`  
현재 브랜치: `docs/project-version-summary`  
대상 독자: GPT Pro에게 현재 기능 상태, 구조, 리스크, 다음 방향을 빠르게 점검시키기 위한 요약 문서

## 1. 이 문서의 목적

이 문서는 "무엇을 만들었는가"보다 "현재 어디까지 동작하고, 구조적으로 어디가 병목인가"를 확인하기 위한 버전 스냅샷이다.

GPT Pro에게 요청할 핵심 검토 범위는 다음이다.

1. 현재 앱이 MVP로 닫힐 수 있는 수준인지 판단
2. 기능 확장 전에 반드시 정리해야 할 구조적 병목 확인
3. Supabase 동기화, 로컬 저장, 보안 경계의 위험도 평가
4. 운동/기록/메모 탭 구조가 제품 방향에 맞는지 판단
5. 다음 1-2개 작업 단위 추천

## 2. 프로젝트 정체성

확인된 사실:

- 제품명은 `Yeonsik's Note`이다.
- `package.json` 기준 앱 이름은 `yeonsik-note`, 버전은 `0.1.0`이다.
- Tauri 설정의 제품명과 실행 바이너리 이름은 `Yeonsik_Note`이다.
- 현재 앱은 Windows 데스크톱을 우선하는 로컬 우선 개인 기록 앱이다.
- 메모, 체크리스트, 운동/식사/체중 기록, 날짜별 기록 조회, 설정 화면을 포함한다.

강한 추론:

- 현재 제품은 단순 메모 앱에서 개인 생산성/생활 기록 앱으로 확장 중이다.
- "운동" 기능은 독립 피트니스 앱이 아니라 기존 메모 앱 안의 기록 도메인으로 들어가 있다.
- 지금 단계에서 가장 높은 ROI는 새 기능 추가가 아니라 V1 기능 경계 확정, 저장/동기화 검증, 불필요 코드 정리이다.

불확실:

- 실제 Supabase 프로젝트에 최신 `supabase/schema.sql`이 모두 적용되었는지는 이 문서 작성 시점에 확인하지 않았다.
- Windows 설치 파일 생성(`npm.cmd run tauri:build`)은 이번 검증에서 실행하지 않았다.
- 브라우저/데스크톱 UI를 직접 조작하는 시각 검증은 이번 문서 작성 범위에 포함하지 않았다.

## 3. 기술 스택

확인된 기술:

- Desktop runtime: Tauri v2
- Frontend: React 18, TypeScript, Vite
- Styling: Tailwind CSS
- Icons: `lucide-react`
- Remote sync: Supabase Postgres, Supabase Realtime
- Local persistence: browser `localStorage`
- Desktop integration: Tauri tray icon, close-to-hide, autostart plugin
- Build/package: Vite build, Tauri NSIS bundle target

주요 실행 명령:

```powershell
npm.cmd install
npm.cmd run dev
npm.cmd run build
npm.cmd run tauri:dev
npm.cmd run tauri:build
```

## 4. 현재 기능 상태

### 4.1 상단 탭 구조

현재 `HeaderBar` 기준 노출 탭:

- `기록`
- `메모`
- `운동`
- `설정`

중요한 차이:

- 기존 `docs/specs/fitness-tab.md`는 `메모`, `운동`, `설정` 3개 탭을 제안한다.
- 실제 구현은 `기록` 탭이 추가되어 4개 탭 구조다.
- 따라서 GPT Pro에게 `기록` 탭을 유지할지, `운동` 또는 `메모` 안으로 통합할지 점검시킬 필요가 있다.

### 4.2 기록 탭

현재 기본 진입 화면은 `records`이다.

기능:

- 월간 캘린더 표시
- 날짜 선택
- 오늘로 이동
- 메모, 할 일, 운동, 식사, 체중 기록 존재 여부를 날짜 셀에 점으로 표시
- 선택 날짜 기준으로 관련 기록 목록 표시

표시되는 항목:

- 해당 날짜에 수정된 메모
- 선택 날짜 이후로 기한이 남은 미완료 할 일
- 해당 날짜의 운동 기록
- 해당 날짜의 식사 기록
- 해당 날짜의 체중 기록

주의:

- `기록` 탭은 조회 중심이다.
- 기록 수정/삭제 액션은 이 화면에 없다.

### 4.3 메모 탭

기능:

- 메모 생성
- 메모 선택
- 제목 수정
- 본문 수정
- 메모 삭제
- 삭제는 hard delete가 아니라 `deletedAt` tombstone 기반 soft delete
- 최신 수정 순으로 표시
- 제목이 비어 있으면 본문 일부를 표시 제목으로 사용

구조:

- 현재 `App.tsx`는 `MemoPanel`을 사용한다.
- `NoteList`, `NoteEditor` 파일도 남아 있지만 현재 앱 진입점에서는 사용되지 않는다.

판단 필요:

- 남은 이전 컴포넌트를 삭제할지
- 다시 분리형 레이아웃으로 되돌릴 가능성이 있으면 보관할지
- 보관한다면 `legacy` 또는 명확한 주석이 필요하다.

### 4.4 체크리스트

기능:

- 할 일 생성
- 할 일 텍스트 수정
- 완료 토글
- 삭제
- 날짜 지정
- 날짜가 있을 때만 시간 지정 가능
- 날짜를 지우면 시간도 함께 제거
- 드래그 기반 순서 변경
- 삭제는 soft delete

정렬:

- UI에는 `deletedAt === null`인 항목만 표시
- `orderIndex` 기준 정렬
- `orderIndex`가 같으면 `updatedAt` 기준 정렬

주의:

- 예전 `TaskPanel` 파일이 남아 있지만 현재 `App.tsx`에서는 `ChecklistPanel`을 사용한다.

### 4.5 운동 탭

현재 운동 탭은 운동, 식사, 체중을 한 화면에서 기록한다.

운동 기록:

- 날짜 선택
- 대분류: `헬스`, `유산소`, `기타`
- 헬스는 고정 부위 다중 선택: 가슴, 등, 하체, 어깨, 복부, 삼두, 이두
- 헬스 부위를 여러 개 선택하면 부위별 운동 기록이 여러 개 생성된다.
- 유산소는 고정 옵션: 실내 달리기, 실내 걷기, 계단 오르기, 실외 싸이클, 실내 싸이클
- 기타는 자유 텍스트 운동명 입력

식사 기록:

- 날짜
- 메뉴
- 칼로리
- 단백질 g
- `carbsGrams`, `fatGrams` 필드는 타입과 저장소에는 있으나 V1 UI에는 노출되지 않는다.

체중 기록:

- 날짜
- kg 단위 체중
- 0보다 큰 값만 허용

통계:

- 날짜 범위 선택
- 운동 총합
- 운동 소분류별 횟수
- 식사 평균 칼로리
- 식사 평균 단백질
- 체중 평균, 최저, 최고

출력:

- 날짜 범위 선택
- Markdown 문자열 생성
- 파일명 형식: `yeonsik-fitness-report-YYYYMMDD-YYYYMMDD.md`
- 브라우저 다운로드 방식으로 `.md` 파일 저장

중요한 제한:

- 운동/식사/체중 기록 삭제 함수는 훅에 존재하지만 `FitnessPanel` UI에는 삭제 버튼이 연결되어 있지 않다.
- 운동/식사/체중 기록 수정 UI도 없다.
- 따라서 현재 운동 탭은 사실상 add-only 기록 루프에 가깝다.

### 4.6 설정 탭

기능:

- 화면 모드: 시스템, 화이트, 다크
- Supabase 연결 상태 표시
- 수동 동기화
- Supabase URL 저장
- Supabase anon key 저장
- User ID 저장
- Windows 시작 시 자동 실행 토글
- 활성 기기 목록 표시

Supabase 설정 저장 방식:

- 실행 시점 `.env`보다 UI에서 저장한 localStorage 설정이 우선이다.
- 설정 저장 키는 `localsyncmemo:supabase-config:v1`이다.
- Supabase 값이 없으면 자동으로 local-only 모드로 내려간다.

### 4.7 데스크톱 동작

Tauri Rust 진입점에서 확인된 기능:

- `load_runtime_config` command
- 실행 시점 `.env` 탐색
- 트레이 메뉴: 열기, 숨기기, 종료
- 트레이 아이콘 좌클릭 시 창 열기
- 창 닫기 요청 시 종료하지 않고 숨김
- 데스크톱 환경에서 autostart plugin 등록
- 모바일 빌드를 고려한 `#[cfg_attr(mobile, tauri::mobile_entry_point)]`
- 데스크톱 전용 tray/autostart/close-to-hide는 `#[cfg(desktop)]`로 감싸져 있다.

## 5. 데이터 구조

핵심 타입은 `src/types/entities.ts`에 있다.

공통 syncable entity:

- `id`
- `updatedAt`
- `deletedAt`
- `deviceId`

현재 스냅샷:

```ts
LocalDataSnapshot {
  notes: Note[];
  tasks: Task[];
  workoutRecords: WorkoutRecord[];
  mealRecords: MealRecord[];
  weightRecords: WeightRecord[];
  devices: Device[];
}
```

로컬 저장:

- 저장소 키: `localsyncmemo:snapshot:v1`
- 저장소 envelope 버전: `1`
- 데이터가 없거나 손상되면 빈 스냅샷으로 시작
- 오래된 스냅샷에 fitness 배열이 없어도 빈 배열로 normalize

기기 저장:

- 저장소 키: `localsyncmemo:device:v1`
- 같은 PC에서 앱을 다시 켜면 같은 device id를 재사용

## 6. 동기화 구조

현재 원칙:

- local-first
- Supabase 설정이 없으면 local-only
- Supabase 설정이 있으면 pull, push, realtime, heartbeat 사용
- 충돌 정책은 MVP 수준 Last Write Wins
- soft delete tombstone을 보존해 삭제 전파

Supabase 테이블:

- `public.devices`
- `public.notes`
- `public.tasks`
- `public.workout_records`
- `public.meal_records`
- `public.weight_records`

Realtime 구독:

- notes
- tasks
- workout_records
- meal_records
- weight_records

Heartbeat:

- `devices.last_seen_at` 기준 활성 기기 표시
- 원격 실패 시에도 로컬 편집을 막지 않음

보안 경계:

- 현재 `USER_ID` 기반 단일 사용자/개발 모드 구조다.
- Supabase Auth는 구현되어 있지 않다.
- RLS 정책은 `supabase/schema.sql`에 제안 주석으로만 있다.
- 공개 배포 전에는 Auth와 실제 RLS 적용이 필요하다.

## 7. 코드 구조

현재 주요 구조:

```text
src/
  app/
    App.tsx
    useLocalSyncMemo.ts
    useThemeMode.ts
  components/
    HeaderBar.tsx
    SettingsPanel.tsx
    StatusBanner.tsx
    EmptyState.tsx
  features/
    notes/
    tasks/
    records/
    fitness/
  lib/
    config/
    desktop/
    device/
    storage/
    sync/
  types/
    entities.ts
src-tauri/
  src/lib.rs
  src/main.rs
  tauri.conf.json
supabase/
  schema.sql
docs/
  specs/fitness-tab.md
  plans/fitness-tab-roadmap.md
```

핵심 병목:

- `useLocalSyncMemo.ts`가 너무 많은 책임을 가진다.
- 현재 이 훅은 런타임 config, localStorage, device, Supabase pull/push, realtime, heartbeat, autostart, notes, tasks, fitness CRUD를 모두 조율한다.
- 기능이 더 늘어나면 디버깅 경로가 길어진다.

분리 후보:

- `useRuntimeConfig`
- `useDeviceSession`
- `useSyncEngine`
- `useNotesDomain`
- `useTasksDomain`
- `useFitnessDomain`
- `useAutostartSetting`

단, 지금 당장 대형 리팩토링을 먼저 하기보다는 V1 기능 경계 확정 후 작은 단위로 분리하는 것이 안전하다.

## 8. 검증 상태

이번 문서 작성 중 실행한 검증:

```powershell
npm.cmd run build
```

결과:

- TypeScript compile 통과
- Vite production build 통과
- 생성물:
  - `dist/index.html`
  - `dist/assets/index-BT6izBQs.css`
  - `dist/assets/index-BMoWSdLd.js`

빌드 중 경고:

- `@tauri-apps/api/core.js`가 `runtimeConfig.ts`에서 dynamic import되고, autostart plugin에서 static import되어 chunk 분리에 대한 Vite 경고가 발생했다.
- 현재는 빌드 실패가 아니라 번들링 경고다.

추가 검증:

```powershell
cargo check
```

결과:

- `src-tauri` Rust compile check 통과

확인되지 않은 검증:

- `npm.cmd run tauri:build`
- 실제 NSIS installer 생성
- Supabase 원격 프로젝트와 live sync
- Realtime 다중 기기 동작
- Playwright 또는 브라우저 수동 UI 검증
- 자동화 테스트

테스트 상태:

- `package.json`에는 test script가 없다.
- 현재 확인된 범위에서 Vitest, Playwright, Testing Library 기반 테스트 파일은 발견되지 않았다.

## 9. Git 및 파일 관리 상태

현재 작업 브랜치:

- `docs/project-version-summary`

문서 작성 전 확인한 상태:

- `main...origin/main`
- 추적되지 않은 로컬 디렉터리:
  - `.idea/`
  - `.understand-anything/`

`.gitignore` 기준 제외 대상:

- `node_modules`
- `dist`
- `.env`, `.env.*`
- 로그
- 실행 파일과 설치 파일
- `src-tauri/target`
- `src-tauri/gen`

주의:

- `dist`와 설치 파일은 소스 저장소가 아니라 빌드/배포 산출물로 취급한다.
- `.env`는 로컬 설정이며 커밋 대상이 아니다.

## 10. 주요 리스크

### 10.1 구조 리스크

`useLocalSyncMemo.ts`가 앱의 모든 도메인과 인프라를 한 번에 잡고 있다. 지금은 동작하지만 다음 기능이 추가되면 변경 영향 범위가 커진다.

권장:

- 기능 추가 전에 훅을 한 번에 쪼개지 않는다.
- 먼저 V1 기능 경계를 닫는다.
- 이후 저장/동기화/도메인 액션 순서로 작은 리팩토링을 진행한다.

### 10.2 제품 구조 리스크

현재 탭은 `기록`, `메모`, `운동`, `설정`이다. 그러나 기존 문서의 방향은 `메모`, `운동`, `설정`이었다.

판단 필요:

- `기록`을 홈 대시보드로 유지할 것인가
- `기록`을 `운동` 탭 안의 캘린더로 통합할 것인가
- `기록`이 메모, 할 일, 운동을 모두 모으는 날짜 기반 command center라면 이름과 역할을 더 명확히 할 것인가

### 10.3 운동 기능 리스크

운동 탭은 기록 추가, 통계, 출력까지 있다. 하지만 수정/삭제 UI가 없다.

권장:

- V1을 add-only로 인정할지 결정
- 아니라면 운동/식사/체중 삭제 버튼부터 추가
- 수정 UI는 삭제보다 후순위

### 10.4 동기화 리스크

Last Write Wins는 MVP에는 적합하지만 충돌 설명력이 낮다.

현재는:

- 최신 `updatedAt` 우선
- 같은 timestamp면 tombstone 보존
- 자기 기기에서 만든 row만 push
- 다른 기기의 변경은 pull/realtime으로 병합

권장:

- 지금 당장 CRDT로 가지 않는다.
- 대신 서비스 함수와 row mapper 테스트를 먼저 추가한다.
- 공개 배포 전에는 conflict log 또는 sync queue를 검토한다.

### 10.5 보안 리스크

현재 Supabase는 개발용 `USER_ID` 공유 구조다.

공개 배포 전 필수:

- Supabase Auth 도입
- RLS 실제 적용
- anon key만으로 다른 사용자 데이터 접근이 불가능한지 확인
- `.env`와 runtime config 경로 문서화

### 10.6 저장소 리스크

현재 localStorage는 MVP에는 빠르지만 데스크톱 앱의 장기 데이터 저장소로는 한계가 있다.

권장:

- 단기: localStorage 유지
- 중기: IndexedDB 또는 SQLite adapter 준비
- 전환 시 `StorageAdapter` 인터페이스를 활용

### 10.7 테스트 리스크

자동화 테스트가 없다. 기능이 저장/동기화/날짜 계산 중심이므로 테스트 없이 확장하면 회귀 위험이 높다.

우선 추가할 테스트 후보:

- `noteService`
- `taskService`
- `fitnessService`
- `fitnessStats`
- `fitnessMarkdownExport`
- `localStorageAdapter` normalize
- Supabase row mapper와 merge rule

## 11. 다음 작업 우선순위

현재 해야 하는 단 하나:

> V1 기능 경계를 닫고, "기록 탭의 역할"과 "운동 기록 삭제/수정 범위"를 결정한다.

추천 순서:

1. `기록` 탭의 제품 역할 결정
2. 운동/식사/체중 삭제 UI 추가 여부 결정
3. 남은 legacy 컴포넌트 정리 여부 결정
4. 서비스/통계/출력 함수 중심 테스트 추가
5. Supabase Auth/RLS 전환 계획 작성
6. localStorage에서 IndexedDB/SQLite로 갈지 판단

확장 보류:

- 운동 세트/반복/중량 추적
- 음식 DB
- AI 칼로리 추정
- 이미지 업로드
- 웨어러블 연동
- 복잡한 캘린더 일정 앱화
- 모바일 확장

이유:

- 현재 앱은 이미 메모, 할 일, 날짜 기록, 운동 기록, 통계, 출력, 동기화까지 넓어졌다.
- 더 확장하기 전에 저장/수정/삭제/동기화의 최소 루프를 안정화해야 한다.

## 12. GPT Pro에게 물어볼 질문

아래 질문을 그대로 넘기면 된다.

```text
이 프로젝트는 Tauri v2 + React + TypeScript 기반 local-first 개인 기록 앱입니다.
현재 메모, 체크리스트, 기록 캘린더, 운동/식사/체중 기록, 통계, Markdown 출력, Supabase 선택 동기화까지 구현되어 있습니다.

첨부한 Version.md 기준으로 다음을 점검해주세요.

1. 현재 기능 범위가 MVP로 닫힐 수 있는지 판단해주세요.
2. `기록`, `메모`, `운동`, `설정` 4탭 구조가 맞는지, 아니면 단순화해야 하는지 판단해주세요.
3. `useLocalSyncMemo.ts`가 너무 많은 책임을 가지고 있는데, 지금 리팩토링해야 할지 V1 안정화 후 분리해야 할지 판단해주세요.
4. 운동/식사/체중 기록에 삭제/수정 UI가 없는 상태를 V1로 허용해도 되는지 판단해주세요.
5. Supabase Auth/RLS가 없는 USER_ID 기반 구조에서 공개 배포 전 반드시 해야 할 작업을 우선순위로 정리해주세요.
6. 테스트를 추가한다면 가장 먼저 테스트할 함수/모듈 5개를 추천해주세요.
7. 다음 작업을 1주일짜리 현실적인 개발 순서로 쪼개주세요.
```

## 13. 결론

현재 프로젝트는 "메모 앱 초안" 단계를 넘어섰다. 이미 날짜 기반 생활 기록 앱의 형태가 생겼다.

다만 아직 지속 가능한 V1이라고 보기에는 세 가지가 부족하다.

1. 탭 역할 정의
2. 운동 기록의 수정/삭제 정책
3. 저장/동기화 로직에 대한 최소 테스트

따라서 다음 목표는 새 기능 추가가 아니라 V1 닫기다.

