# Yeonsik's Note

Yeonsik's Note는 Tauri v2, React, TypeScript, Vite, Tailwind CSS, Supabase를 기반으로 만든 로컬 우선 데스크톱 메모/체크리스트 앱입니다.

핵심 목표는 빠른 기록과 할 일 관리를 먼저 로컬에서 보장하고, Supabase가 설정된 경우 여러 기기 사이의 동기화까지 확장하는 것입니다. 네트워크가 없거나 Supabase 환경 변수가 비어 있어도 앱은 로컬 전용 모드로 계속 동작합니다.

## 현재 역할

이 저장소는 단순 웹 메모장이 아니라 Windows 데스크톱 앱으로 배포 가능한 개인 생산성 도구입니다.

- 메모와 체크리스트를 한 화면에서 관리한다.
- 저장 버튼 없이 로컬에 자동 저장한다.
- Supabase 설정이 있으면 Postgres, Realtime, device heartbeat로 여러 기기 상태를 맞춘다.
- Tauri system tray, 창 숨김, 자동 실행 설정을 통해 데스크톱 앱처럼 동작한다.
- 날짜/시간이 있는 체크리스트 구조를 기반으로 이후 캘린더 기능까지 확장할 수 있다.

## 주요 기능

### 메모

- 메모 생성, 선택, 제목 수정, 본문 수정
- `deletedAt` tombstone 기반 soft delete
- 앱 재실행 후 로컬 데이터 유지
- Supabase 설정 시 다른 기기 변경사항 반영

### 체크리스트

- 할 일 생성, 수정, 완료 처리, 삭제
- 드래그 기반 순서 변경
- 항목별 선택형 날짜와 시간 저장
- 날짜를 지우면 시간도 함께 비우는 데이터 규칙
- `due_date` 인덱스를 이용한 향후 날짜별 조회 확장 가능

### 설정

- 화면 모드: 시스템, 화이트, 다크
- Supabase 연결 상태 확인
- 수동 동기화
- Windows 시작 시 자동 실행 설정
- 현재 활성 기기 목록 표시

### 데스크톱 동작

- Tauri v2 기반 Windows 앱
- 닫기 버튼을 누르면 종료하지 않고 창을 숨김
- system tray 메뉴: 열기, 숨기기, 종료
- NSIS 설치 파일과 MSI 설치 파일 생성 가능

## 기술 스택

- Runtime: Tauri v2
- UI: React 18, TypeScript
- Build: Vite
- Styling: Tailwind CSS
- Icons: lucide-react
- Remote sync: Supabase Postgres, Supabase Realtime
- Local storage: browser `localStorage`
- Desktop plugin: Tauri autostart

## 프로젝트 구조

```text
src/
  app/
    App.tsx                 # 화면 전환과 주요 패널 조립
    useLocalSyncMemo.ts     # 앱 상태, 로컬 저장, Supabase 동기화 조율
    useThemeMode.ts         # 시스템/화이트/다크 테마 처리
  components/
    HeaderBar.tsx           # 저장/동기화/기기 상태 표시
    SettingsPanel.tsx       # 설정, 수동 동기화, 자동 실행, 활성 기기
    StatusBanner.tsx        # 오류 상태 표시
  features/
    notes/                  # 메모 UI와 메모 엔티티 서비스
    tasks/                  # 체크리스트 UI와 할 일 엔티티 서비스
  lib/
    desktop/                # Tauri 데스크톱 기능 래퍼
    device/                 # 로컬 기기 id/name 생성
    storage/                # localStorage 저장소 어댑터
    sync/                   # local-only 또는 Supabase 동기화 클라이언트
  types/
    entities.ts             # Note, Task, Device, Snapshot 타입
src-tauri/
  src/lib.rs                # Tauri tray, close-to-hide, autostart 연결
  tauri.conf.json           # 앱 이름, 창 크기, 번들 설정
supabase/
  schema.sql                # 원격 동기화용 DB 스키마
```

## 데이터 모델

앱은 `LocalDataSnapshot` 하나에 메모, 체크리스트, 기기 정보를 묶어서 저장합니다.

```text
LocalDataSnapshot
  notes: Note[]
  tasks: Task[]
  devices: Device[]
```

공통 엔티티 필드:

- `id`: 엔티티 고유 id
- `updatedAt`: 마지막 수정 시간
- `deletedAt`: soft delete 전파용 삭제 시간
- `deviceId`: 변경을 만든 기기 id

체크리스트 항목은 다음 필드를 추가로 가집니다.

- `text`: 할 일 내용
- `isDone`: 완료 여부
- `orderIndex`: 화면 정렬 순서
- `dueDate`: 선택형 날짜
- `dueTime`: 선택형 시간

## 저장과 동기화 구조

기본 원칙은 local-first입니다.

1. 앱 시작 시 localStorage에서 즉시 데이터를 읽는다.
2. Supabase 설정이 있으면 원격 데이터를 pull해서 로컬 스냅샷과 병합한다.
3. 사용자가 수정하면 먼저 React 상태와 localStorage에 저장한다.
4. Supabase 설정과 네트워크가 있으면 현재 기기에서 수정한 row를 push한다.
5. 다른 기기의 변경사항은 Supabase Realtime으로 받아 로컬 스냅샷에 병합한다.

현재 충돌 정책은 MVP 기준 Last Write Wins입니다. `updatedAt`이 더 최신인 row가 우선이며, 시간이 같을 때는 삭제 tombstone이 보존됩니다.

## Supabase 설정

Supabase를 쓰지 않으면 `.env`를 비워도 앱은 로컬 전용으로 실행됩니다. 여러 기기 동기화가 필요하면 Supabase 프로젝트를 만들고 아래 값을 설정합니다.

```powershell
Copy-Item .env.example .env
```

```env
VITE_SUPABASE_URL=
VITE_SUPABASE_ANON_KEY=
VITE_USER_ID=
```

개발 단계에서는 `VITE_USER_ID`가 단일 사용자 식별자입니다. 같은 데이터를 공유할 기기들은 같은 `VITE_USER_ID` 값을 사용해야 합니다.

Supabase SQL Editor에서 다음 파일 내용을 실행합니다.

```text
supabase/schema.sql
```

생성되는 테이블:

- `public.notes`
- `public.tasks`
- `public.devices`

체크리스트 날짜/시간 동기화를 위해 `public.tasks`에는 다음 컬럼이 필요합니다.

```sql
alter table public.tasks
  add column if not exists due_date date;

alter table public.tasks
  add column if not exists due_time time;

create index if not exists tasks_user_due_date_idx
  on public.tasks(user_id, due_date);
```

## 실행 방법

의존성 설치:

```powershell
npm.cmd install
```

웹 개발 서버:

```powershell
npm.cmd run dev
```

Tauri 개발 실행:

```powershell
npm.cmd run tauri:dev
```

프론트엔드 빌드 검증:

```powershell
npm.cmd run build
```

Windows 앱과 설치 파일 빌드:

```powershell
npm.cmd run tauri:build
```

Tauri 빌드 전에 실행 중인 `Yeonsik_Note.exe`가 있으면 Windows가 파일을 잠글 수 있습니다. 빌드가 `failed to remove file` 또는 `os error 5`로 실패하면 앱 창과 트레이 앱을 먼저 종료한 뒤 다시 빌드합니다.

## 빌드 산출물

빌드 성공 시 주요 산출물은 다음 위치에 생성됩니다.

```text
src-tauri/target/release/Yeonsik_Note.exe
src-tauri/target/release/bundle/nsis/Yeonsik_Note_0.1.0_x64-setup.exe
src-tauri/target/release/bundle/msi/Yeonsik_Note_0.1.0_x64_en-US.msi
```

`dist`, `src-tauri/target`, `.exe`, `.msi`는 소스 저장소에 커밋하는 대상이 아닙니다. 설치 파일은 GitHub Releases 같은 배포 채널에 올리는 것이 맞습니다.

## 현재 보안 경계

현재 구조는 개인 개발/MVP 단계에 맞춰져 있습니다.

- Supabase URL과 anon key는 Vite 빌드 시 앱에 포함됩니다.
- 설치 사용자에게 `.env`를 입력받는 구조가 아닙니다.
- `VITE_USER_ID` 기반 분리는 개발용 단일 사용자 방식입니다.
- 공개 배포 전에는 Supabase Auth와 RLS 정책을 실제로 적용해야 합니다.

현재 `supabase/schema.sql`에는 RLS 정책이 제안 주석으로만 들어 있습니다. 실제 운영 보안으로 간주하면 안 됩니다.

## 확장 가능성

이 앱의 다음 확장은 기존 구조를 유지하면서 작은 단위로 진행하는 것이 맞습니다.

우선순위가 높은 확장:

- 체크리스트 날짜 기반 일간/주간 보기
- 캘린더 패널 추가
- 기기 이름 편집 UI
- Supabase Auth 도입
- 사용자별 RLS 정책 적용

중간 단계 확장:

- 변경 로그 기반 sync queue
- IndexedDB 또는 SQLite 저장소 어댑터
- 반복 일정과 알림
- 완료한 할 일 아카이브
- 메모 검색과 태그

나중에 고려할 확장:

- 파일/이미지 첨부
- Markdown 편집 모드
- 충돌 해결 UI
- CRDT 기반 병합
- 자동 업데이트 배포 파이프라인

## 개발 원칙

- 로컬 저장이 먼저 동작해야 한다.
- Supabase 실패가 편집 기능을 막으면 안 된다.
- 데이터 모델 변경 시 localStorage 하위 호환 처리를 같이 한다.
- Supabase 컬럼 변경 시 `schema.sql`과 TypeScript row 매핑을 함께 수정한다.
- 설치 파일을 만들기 전 `npm.cmd run build`로 프론트 타입/번들을 먼저 검증한다.
- 설치 파일 빌드 후에는 NSIS와 MSI 산출물 위치를 확인한다.
