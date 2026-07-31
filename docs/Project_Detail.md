# Personal OS | Project Detail

> 이 문서는 Personal OS의 로컬 우선 구조, 기능 모듈, 동기화 경계, Fitness App·CashOS 통합과 릴리스 전 조건을 설명한다.

| 항목 | 내용 |
| --- | --- |
| 문서 상태 | Active draft |
| 적용 범위 | `feat/personal_os`의 현재 dirty working tree |
| 최종 갱신 | 2026-07-27T00:09:00+09:00 |
| 기준 커밋 | `60f2d675ab4a70e2b8462538f81ac8eda836a947` |
| 진실 원천 | React·Tauri 코드, Supabase migration, 테스트, 릴리스 체크리스트 |

## 1. 문서 목적과 범위

### 포함

- 메모·할 일·빠른 기록·기록 캘린더
- Fitness 기록 계약과 요약
- CashOS 금융 요약 조회
- 로컬 저장과 Supabase 동기화
- Tauri tray·autostart·global shortcut
- 로컬 테스트·웹 빌드와 미검증 릴리스 게이트

### 제외

- Fitness App의 상세 종목·세트 구현
- CashOS의 상세 금융 원장·손익 구현
- 운영 Supabase·Windows 배포 완료 주장
- 자동 업데이트·스토어 배포 완료 주장

## 2. 시스템 아키텍처

```text
Tauri desktop shell
  → tray / autostart / global shortcut / runtime config
  → React App
      → notes / tasks / quick-capture
      → records / fitness / finance
      → local storage adapter
      → sync client factory
          → local-only client
          → Supabase client
              → Auth / pull / push / realtime / summary views
```

코드 그래프에서 `app`은 feature와 `lib`를 조합하는 진입 계층, `features`는 사용자 기능, `lib`는 저장·동기화·플랫폼 공통 경계로 나타난다. 주요 군집은 local hydration·기록 생성, 캘린더·내보내기, fitness 집계, sync pull·push·realtime, quick capture, 설정·계정 바인딩이다.

### 컴포넌트 책임

| 컴포넌트 | 책임 | 실패 시 영향 |
| --- | --- | --- |
| `src/app` | 기능 조합과 최상위 상태 | 전체 UI와 동기화 조정 실패 |
| `src/features/notes`, `tasks` | 메모·할 일 UX와 도메인 규칙 | 기본 기록 흐름 손상 |
| `src/features/quick-capture` | 빠른 입력 파싱·패널 | 즉시 기록 흐름 손상 |
| `src/features/records` | 날짜별 통합 표시 | 타임라인·캘린더 판단 불가 |
| `src/features/fitness` | 공통 운동 기록·요약·통계 | 운동 요약 불일치 |
| `src/features/finance` | CashOS 일별 요약 표시 | 금융 캘린더 누락 |
| `src/lib/storage` | 로컬 영속화·하위 호환 정규화 | 오프라인 기록 손실 위험 |
| `src/lib/sync` | Auth, pull, push, realtime, 매핑 | 기기 간 데이터 불일치 |
| `src-tauri` | Windows 네이티브 기능과 패키징 | tray·단축키·설치 불가 |

## 3. 데이터 모델과 불변식

| 데이터 | 소유 경계 | 동기화 |
| --- | --- | --- |
| notes, tasks, devices | Personal OS | 로컬 우선 후 Supabase |
| workout parent summaries | 공통 계약 | Personal OS와 Fitness App |
| workout exercises, sets | Fitness App | Personal OS는 상세 수정 안 함 |
| meal, weight records | Personal OS 공통 기록 | Supabase |
| finance daily/monthly summaries | CashOS가 계산 | Personal OS는 읽기 전용 |

핵심 불변식은 다음과 같다.

1. 편집은 네트워크 응답을 기다리지 않고 로컬에서 먼저 반영한다.
2. 동기화 행은 `updated_at`, `deleted_at`, 사용자 소유권을 유지한다.
3. 계정이 바뀌면 기존 로컬 DB를 다른 사용자에게 조용히 바인딩하지 않는다.
4. Fitness 상세 데이터는 Fitness App 소유이고 Personal OS는 요약을 사용한다.
5. 금융 원장은 CashOS 소유이고 Personal OS는 요약 뷰만 읽는다.
6. 서비스 역할 키와 사용자가 입력한 임의 `USER_ID`를 클라이언트 권한 근거로 사용하지 않는다.

## 4. 핵심 기술 의사결정

### 결정 1. local-first와 sync-later 분리

- **상황**: 개인 기록은 네트워크 상태와 무관하게 즉시 입력돼야 한다.
- **선택**: storage adapter와 sync client를 분리하고 local-only fallback을 제공한다.
- **결과**: 원격 장애가 기본 기록 CRUD를 직접 막지 않는다.
- **비용**: 충돌·재시도·정규화 규칙을 명시적으로 관리해야 한다.

### 결정 2. Tauri v2로 Windows 네이티브 기능 제공

- **상황**: 작은 설치 크기와 tray·autostart·global shortcut이 필요하다.
- **선택**: React/Vite UI를 Tauri shell에 결합한다.
- **결과**: 웹 UI 재사용과 Windows 네이티브 진입점을 함께 가진다.
- **남은 위험**: 설치 파일 서명과 실제 Windows 환경 검증이 필요하다.

### 결정 3. 도메인 앱은 요약 계약으로 연결

- **상황**: Personal OS가 Fitness·CashOS 상세 스키마에 결합되면 모든 변경이 상위 앱에 전파된다.
- **선택**: Fitness parent summary와 finance summary view만 소비한다.
- **결과**: Personal OS는 요약·판단, 도메인 앱은 상세 입력이라는 책임이 유지된다.

## 5. 동기화와 데이터 흐름

```text
사용자 입력
  → local storage write
  → UI 즉시 갱신
  → 인증·온라인 확인
  → syncPush
  → Supabase RLS

앱 시작·수동 새로고침
  → syncPull
  → row mapping·정규화
  → local hydrate
  → realtime subscription
```

금융 캘린더는 `isAuthenticatedFor`를 통과한 뒤 `finance_summary_daily`에서 날짜·유입·유출·순액·건수만 조회한다. 상세 원장 테이블을 직접 스캔하지 않는다.

## 6. 외부 연동과 실패 경계

| 대상 | 목적 | 인증·비밀값 | 실패 처리 | 현재 검증 |
| --- | --- | --- | --- | --- |
| Supabase Auth | 사용자 세션·계정 바인딩 | runtime URL·anon key·사용자 세션 | local-only 상태 또는 오류 표시 | 코드 검증 |
| Supabase Postgres | 기록 pull·push | access token·RLS | 재시도 가능한 동기화 상태 | 코드·테스트 검증 |
| Supabase Realtime | 온라인 변경 반영 | access token | 구독 해제·재연결 | 코드 검증 |
| Tauri runtime | tray·단축키·설정 파일 | 로컬 설정 | 플랫폼 기능 상태 반환 | 저장소 검증 |
| Fitness App | 완료 운동 요약 | 공통 계약·같은 Auth 사용자 | 상세 데이터는 앱에 남김 | 저장소 간 계약 존재 |
| CashOS | 금융 요약 | 같은 Auth 사용자·요약 뷰 | 캘린더 오류·빈 상태 | 저장소 간 코드 존재 |

## 7. 데이터 보호와 보안

- Supabase 설정은 배포 번들에 하드코딩하지 않고 실행 시점 설정 경로에서 읽는다.
- access token과 RLS가 사용자 데이터 권한 경계다.
- 2026-07 RLS migration은 anon 접근을 차단하고 사용자 소유권 검사를 포함한다.
- Tauri CSP는 기본 self 정책과 필요한 HTTPS·WSS 연결만 허용한다.
- 앱은 서비스 역할 키를 포함하지 않는다.
- 운영 migration 적용, legacy user backfill, 두 계정 격리는 아직 현재 실행에서 검증되지 않았다.

## 8. 테스트와 검증 전략

| 계층 | 도구 | 대상 | 현재 결과 |
| --- | --- | --- | --- |
| 단위 테스트 | Vitest | merge, quick capture, records, fitness, finance | 32개 통과 |
| 타입·웹 빌드 | TypeScript, Vite | React 앱 전체 | 통과, 큰 chunk 경고 |
| Tauri 빌드 | Cargo, Tauri CLI | Windows 실행 파일·NSIS | 이번 작업에서 미실행 |
| release 검증 | PowerShell | 버전·산출물·Authenticode | 이번 작업에서 미실행 |
| 운영 통합 | Supabase·두 계정 | Auth·RLS·교차 앱 동기화 | 미검증 |
| 실사용 E2E | Windows·Android | tray·단축키·완료 요약 | 미검증 |

검증 시각은 2026-07-27T00:09:00+09:00이며 기준은 위 dirty working tree다.

## 9. 배포·운영·복구

```text
기능 브랜치 검토
  → test + TypeScript/Vite build
  → Tauri/NSIS build
  → Windows release 검증·서명
  → Supabase migration·RLS 검증
  → 설치된 binary와 Android 교차 앱 smoke test
  → 단계 배포
```

- DB 변경 전 백업과 legacy user ownership 확인이 필요하다.
- Windows 설치 파일은 trusted Authenticode 서명 전 공개 배포 완료로 간주하지 않는다.
- 원격 장애 시 local-first 기록은 유지하되 동기화 상태를 사용자에게 명시해야 한다.
- `main`에 검토된 문서 변경이 반영되면 Notion 미러를 자동 갱신하며, 수동 `PUBLISH`는 첫 발행과 복구에만 사용한다.

## 10. 한계, 기술 부채, 다음 단계

| 우선순위 | 항목 | 영향 | 다음 행동 |
| --- | --- | --- | --- |
| P0 | 운영 Auth·RLS 격리 미검증 | 개인 데이터 노출 위험 | 두 계정 CRUD 격리 테스트 |
| P0 | Windows 서명·설치 smoke test 미검증 | 공개 배포 불가 | 서명된 NSIS 설치·제거 검증 |
| P0 | 교차 앱 실제 동기화 미검증 | Fitness·금융 요약 불확실 | 동일 계정으로 완료 세션·금융 일별 조회 |
| P1 | README 일부 설명과 현재 Auth 코드 불일치 | 운영자 판단 오류 | README 보안 경계 갱신 |
| P2 | 큰 프론트엔드 chunk | 초기 로딩 비용 가능성 | 실제 측정 후 기능 단위 분할 |

지금 해야 하는 단 하나는 운영 Supabase에서 두 계정 격리와 두 도메인 요약 경계를 함께 검증하는 것이다.

## 11. 관련 문서

- [Project Intro](./Project_Intro.md)
- [Fitness Record Contract v1](./FITNESS_RECORD_CONTRACT_V1.md)
- [Release Readiness](./RELEASE_READINESS.md)
- [Original OS Spec](./ORIGINAL_OS_SPEC.md)
