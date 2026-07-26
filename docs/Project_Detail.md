# Personal OS | Project Detail

> 이 문서는 Personal OS `main`의 local-first 구조, 기능 모듈, Supabase 동기화, Tauri 경계와 검증 수준을 설명한다.

| 항목 | 내용 |
| --- | --- |
| 문서 상태 | Active |
| 적용 범위 | 원격 `main` |
| 최종 갱신 | 2026-07-27 |
| 앱 코드 기준 | `60f2d675ab4a70e2b8462538f81ac8eda836a947` |
| 문서 진실 원천 | Git 저장소의 `docs/Project_Detail.md` |

## 1. 문서 목적과 범위

### 포함

- 메모·할 일·quick capture·기록 캘린더·fitness 기능
- localStorage adapter와 Supabase sync client
- Tauri tray·autostart·global shortcut 경계
- 저장소에서 재현한 테스트와 웹 빌드

### 제외

- CashOS 상세 금융 원장
- 운영 Supabase 적용 완료, Windows 설치·서명, 실사용 E2E 주장
- 아직 코드에 없는 파일 첨부, CRDT, 자동 업데이트

## 2. 문제 맥락과 제약

개인 기록은 입력 마찰이 낮고 오프라인에서도 유지되어야 한다. 동시에 여러 기기 동기화를 붙이더라도 원격 장애가 기본 기록을 막아서는 안 된다. Windows 데스크톱 통합까지 필요하지만 1인 MVP 범위이므로 복잡한 서버나 분산 충돌 알고리즘을 먼저 도입하지 않는다.

## 3. 범위와 구현 현황

| 기능 | 구현 상태 | 검증 수준 | 근거 | 남은 위험 |
| --- | --- | --- | --- | --- |
| 메모·할 일 | 구현 완료 | 테스트·빌드 | feature modules | 브라우저 E2E 없음 |
| quick capture | 구현 완료 | 테스트·빌드 | parser test, Tauri commands | Windows 실제 shortcut 미검증 |
| 기록·fitness | 구현 완료 | 테스트·빌드 | aggregation·fitness tests | 실사용 데이터 검증 없음 |
| local-only 저장 | 구현 완료 | 테스트·빌드 | storage adapter | 대용량·손상 복구 미검증 |
| Supabase sync | 구현 | 코드·migration 검토 | sync client, RLS migration | 운영 교차 기기 미검증 |
| Tauri 패키징 | 구성 존재 | 미검증 | `src-tauri` | NSIS·서명 미실행 |

## 4. 시스템 아키텍처

```text
Tauri desktop shell
  → React App
      → app orchestration
      → features
          notes / tasks / quick-capture / records / fitness
      → lib
          storage / sync / desktop / platform / auth config
      → localStorage or Supabase
```

codebase-memory-mcp의 `main` 기반 moderate 그래프는 문서 런타임을 포함해 1,326개 노드와 2,770개 엣지를 식별했다. 가장 큰 경계는 `app → features`, `features → lib`이며, `formatLocalDate`, `createTimestamp`, `isRecord`, `getOnlineState`가 여러 기능에서 공유되는 중심 함수다.

### 컴포넌트 책임

| 컴포넌트 | 책임 | 실패 시 영향 |
| --- | --- | --- |
| `src/app` | 전역 상태와 기능 조립 | 전체 화면·동기화 조율 실패 |
| `src/features` | 사용자 기능과 도메인 흐름 | 해당 기록 종류 사용 불가 |
| `src/lib/storage` | 로컬 영속화·정규화 | 오프라인 데이터 손실 위험 |
| `src/lib/sync` | pull·push·Realtime·row mapping | 원격 동기화 실패 |
| `src-tauri` | tray·shortcut·autostart | 데스크톱 진입 기능 실패 |

## 5. 도메인 모델과 불변식

| 엔터티 | 진실 원천 | 동기화 |
| --- | --- | --- |
| note / task / device | local snapshot + Supabase | 지원 |
| workout / meal / weight | local snapshot + Supabase | 지원 |
| quick capture draft | UI 입력 | note/task 등으로 변환 |

1. 로컬 변경은 사용자에게 먼저 반영되고 짧은 debounce 후 저장된다.
2. 동기화 엔터티는 `updatedAt`, `deletedAt`, `deviceId`를 사용한다.
3. 삭제 tombstone은 병합 과정에서 보존되어야 한다.
4. 계정이 바뀌면 이전 사용자 데이터가 새 계정으로 자동 귀속되어서는 안 된다.

## 6. 핵심 기술 의사결정

### 결정 1. storage와 sync를 인터페이스로 분리

- **선택**: `StorageAdapter`와 local-only/Supabase sync client를 분리했다.
- **근거**: 오프라인 기록과 원격 연결을 독립적으로 실패·교체할 수 있다.
- **비용과 위험**: 정규화와 병합 규칙이 여러 경계에 걸쳐 복잡해진다.

### 결정 2. Tauri v2

- **선택**: React/Vite UI를 Tauri shell에 넣고 tray·autostart·global shortcut을 Rust command와 plugin으로 연결했다.
- **근거**: 웹 UI 재사용과 Windows 상주 기능을 함께 제공한다.
- **비용과 위험**: Rust·Node·Windows toolchain, 서명, 설치 파일 검증이 추가된다.

## 7. 외부 연동과 실패 경계

| 연동 대상 | 목적 | 설정/인증 | 실패 처리 | 실환경 확인 |
| --- | --- | --- | --- | --- |
| localStorage | 기본 로컬 저장 | 브라우저/Tauri runtime | 오류 상태 노출 필요 | 테스트 통과 |
| Supabase Auth/Postgres | 사용자별 동기화 | runtime config·사용자 세션 | local-only 또는 오류 상태 | 운영 미검증 |
| Supabase Realtime | 타 기기 변경 수신 | 사용자 세션 | 구독 해제·재연결 경계 | 운영 미검증 |
| Tauri runtime | tray·shortcut·autostart | 로컬 설정 | 플랫폼 fallback | Windows E2E 미검증 |
| Notion API | 문서 미러 | GitHub Environment secrets | workflow 실패 | 시크릿 입력 전 |

## 8. 데이터 보호와 보안

- `20260609_auth_rls_life_command_center.sql`은 `auth.uid() = user_id` 소유권 정책을 정의한다.
- migration 존재는 운영 DB 적용 증거가 아니므로 실제 linked migration과 두 계정 격리 검증이 필요하다.
- 런타임 설정과 token을 문서·Git 로그에 남기지 않는다.
- Notion token과 page ID는 `notion-production` Environment secret에만 둔다.
- localStorage는 암호화 저장소가 아니므로 민감 데이터 보안 완료로 표현하지 않는다.

## 9. 테스트와 검증 전략

| 수준 | 도구 | 검증 대상 | 현재 상태 |
| --- | --- | --- | --- |
| 단위 테스트 | Vitest | merge, quick capture, records, fitness | 5파일 24테스트 통과 |
| 타입·웹 빌드 | TypeScript, Vite | React 앱 전체 | 통과, chunk 경고 |
| 공급망 | npm audit | 의존성 | high 2건 남음 |
| 데스크톱 빌드 | Cargo, Tauri CLI | 실행 파일·NSIS | 미실행 |
| 운영 통합 | Supabase, Windows | Auth·RLS·동기화·tray | 미검증 |

## 10. 배포·운영·복구

```text
기능 브랜치
  → test + web build
  → Tauri build
  → PR
  → main
  → 서명·설치·smoke test
```

- 문서 변경이 `main`에 반영되면 Notion 미러는 자동 갱신된다.
- 첫 발행과 장애 복구는 workflow dispatch의 `PUBLISH` 확인값을 사용한다.
- local-first 데이터 복구는 저장소 adapter의 export·backup 정책이 별도로 필요하다.
- DB 변경은 migration 적용 이력과 이전 schema 복구 가능성을 함께 확인해야 한다.

## 11. 한계, 기술 부채, 다음 단계

| 우선순위 | 항목 | 영향 | 다음 행동 |
| --- | --- | --- | --- |
| P0 | npm high 취약점 2건 | 공급망 위험 | 도달 가능성 분석과 안전한 업그레이드 |
| P0 | 운영 RLS·교차 기기 미검증 | 개인 데이터 격리 불확실 | linked migration과 두 계정 E2E |
| P0 | Windows 설치·서명 미검증 | 배포 준비도 불확실 | Tauri/NSIS build와 서명 확인 |
| P2 | 500 kB 초과 chunk | 초기 로딩 비용 | 실제 측정 후 기능 단위 분할 |

지금 해야 하는 한 단계는 npm 감사의 high 2건이 제품 실행 경로에 도달하는지 확인하고 최소 업그레이드로 제거하는 것이다.

## 12. 관련 문서

- [Project Intro](./Project_Intro.md)
- [README](../README.md)
- [Life Command Center Spec](./specs/life-command-center.md)
- [Auth and RLS Spec](./specs/auth-rls-share.md)
