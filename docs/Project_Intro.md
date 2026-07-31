# Personal OS | 흩어진 하루 기록을 하나의 로컬 우선 관제 화면으로

> Personal OS는 메모·할 일·운동·식사·체중을 네트워크보다 먼저 로컬에 기록하고, 선택적으로 Supabase와 동기화하며, FitnessApp과 CashOS의 데이터를 요약 계약으로 연결하는 개인 생산성 애플리케이션이다.

| 항목 | 내용 |
| --- | --- |
| 프로젝트 형태 | 개인 프로젝트 |
| 담당 범위 | 제품 구조, React UI, 로컬 저장, Supabase 동기화, Tauri 네이티브 통합, 검증 자동화 |
| 현재 상태 | 1.0 코드 후보. 로컬 type/test/web·Tauri build와 브라우저 핵심 흐름 확인, 서명·설치·운영 연동 미검증 |
| 문서 기준 | commit `dc45172f965528aa66d375d30a4ac781c9f9c6de` |
| 검증일 | 2026-08-01 |
| 주요 기술 | React 18, TypeScript, Vite, Tauri v2, Supabase, Vitest |
| Repository | [Yeon-sik/Always_Memo](https://github.com/Yeon-sik/Always_Memo) |
| 상세 문서 | [Project_Detail.md](./Project_Detail.md) |

## 1. 30초 요약

- **문제**: 메모, 할 일, 건강 기록과 금융 내역이 여러 앱에 흩어지면 하루 상태를 한눈에 판단하기 어렵고, 원격 서비스 장애가 입력을 막을 수 있다.
- **해결**: 모든 입력을 로컬 snapshot에 먼저 반영하고, 기록 캘린더와 Quick Capture로 접근 비용을 줄였다. Supabase는 선택 동기화 계층으로 두고 FitnessApp·CashOS는 상세 테이블이 아닌 명시적인 요약 계약으로 연결했다.
- **구조 개선**: 거대 hook과 client를 없애지 않고 facade로 유지하면서 runtime/store/domain action, mapper/I/O/realtime/presence, 화면 component/hook 경계로 나눴다. 기존 App contract와 사용자 흐름을 유지하면서 변경 범위를 좁힌 선택이다.
- **현재 결과**: commit `dc45172f` 기준 TypeScript 검사, 20개 파일의 Vitest 82개, Vite build, Tauri release·NSIS build가 통과했다. 로컬 브라우저에서 주요 CRUD와 reload persistence도 확인했다.
- **완료가 아닌 부분**: Windows 설치 바이너리의 tray·단축키·자동 실행, Authenticode 서명, 실제 Supabase RLS·다중 기기, CashOS 동일 fixture 연동은 아직 검증되지 않았다.

## 2. 문제와 해결

| 사용자·개발 문제 | 해결 방식 | 확인된 근거 |
| --- | --- | --- |
| 네트워크 상태가 기록을 방해한다 | `StorageAdapter`와 local-only client로 원격 미설정 상태의 로컬 기록을 지원한다 | storage·runtime 구현, 로컬 브라우저 reload 확인. Auth 초기화 예외는 [#31](https://github.com/Yeon-sik/Always_Memo/issues/31) |
| 여러 종류의 기록을 오가느라 판단이 느리다 | 기록 화면에서 날짜별 메모·할 일·운동·식사·체중과 요약 차트를 함께 보여준다 | records module과 브라우저 dashboard smoke |
| 빠른 기록을 위해 앱 안쪽까지 이동해야 한다 | 앱 내부 Quick Capture와 browser fallback을 제공하고 desktop entry는 Tauri event로 분리한다 | parser/test와 로컬 브라우저 fallback 확인 |
| 한 hook이 저장·인증·동기화·모든 CRUD를 함께 소유한다 | `useLocalSyncMemo`는 facade로 남기고 runtime, snapshot store, domain action hook을 추출한다 | `src/app`, `src/features/*/use*Actions.ts` |
| Supabase client 변경이 모든 원격 기능에 번진다 | client facade 아래 row mapper, snapshot I/O, Realtime, presence, finance query를 분리한다 | `src/lib/sync/supabase`와 관련 테스트 |
| 도메인 앱의 상세 schema에 결합될 수 있다 | Fitness는 parent summary, CashOS는 `finance_summary_daily`만 읽는 계약을 둔다 | Fitness Record Contract와 finance query 구현 |

## 3. 핵심 기능과 결과

| 영역 | 구현 결과 | 2026-08-01 검증 수준 |
| --- | --- | --- |
| 메모 | 생성·조회·수정·soft delete, 자동 저장 | 로컬 브라우저 CRUD와 reload persistence 확인 |
| 할 일 | 생성·수정·완료 toggle·삭제, 일정·순서 변경 | 로컬 브라우저 CRUD·toggle 확인, reorder 단위 테스트 |
| 운동·식사·체중 | 입력, 날짜별 dashboard, soft delete, 운동 삭제 undo | 로컬 브라우저 create/dashboard/delete와 workout undo 확인 |
| Quick Capture | 메모·할 일 parser, panel, browser fallback, desktop event | parser 단위 테스트와 로컬 브라우저 fallback 확인 |
| 기록 화면 | 캘린더, 생산성·영양·체중 집계, 일별 기록 | selector 테스트와 로컬 브라우저 확인 |
| FitnessApp 연결 | v1 parent/detail 소유권과 scope 계약 | 저장소 contract·mapper 테스트, 실제 교차 앱 미검증 |
| CashOS 연결 | 인증된 `finance_summary_daily` 기간 조회 | mapper/query 테스트, 실제 동일 fixture 미검증 |
| Supabase 동기화 | Auth, pull/push, Realtime, tombstone, presence, 계정 binding | 단위·characterization 테스트, 실제 프로젝트·다중 기기 미검증 |
| Windows 통합 | tray, global shortcut, autostart, close-to-hide, NSIS 구성 | Tauri release·NSIS build 통과, 설치 runtime 미검증 |
| 품질 gate | pull request/main에서 typecheck·test·build 실행 | workflow가 저장소에 구성됨, 이 문서에서 원격 run은 검증하지 않음 |

## 4. 핵심 사용 흐름

```text
사용자 입력
  → 공통 commitSnapshot으로 UI와 최신 snapshot ref 갱신
  → debounce local save
  → Supabase 설정·Auth·온라인 상태 확인
  → push / pull / realtime merge

날짜 선택
  → 메모·할 일·운동·식사·체중 집계
  → records dashboard와 calendar 갱신
  → CashOS finance summary는 계약이 있는 경우에만 read-only 조회
```

브라우저와 desktop 경계도 분리했다. 브라우저는 앱 내부 Quick Capture fallback을 사용하고, Tauri desktop은 같은 React 흐름을 tray·`Alt+Space` event와 연결한다. 후자의 설치 환경 동작은 build 성공과 별개의 검증 항목이다.

## 5. 검증 현황

기준은 commit `dc45172f965528aa66d375d30a4ac781c9f9c6de`, Windows 개발 환경, 2026-08-01이다.

| 검증 항목 | 결과 | 증거와 경계 |
| --- | --- | --- |
| `npm.cmd run typecheck` | 통과 | TypeScript no-emit 검사 |
| `npm.cmd test` | 통과 | Vitest 20 files, 82 tests |
| `npm.cmd run build` | 통과 | Vite main bundle 549.83 kB, 기존 500 kB 초과 warning 유지 |
| `npm.cmd run tauri:build` | 통과 | Tauri release executable과 NSIS bundle 생성 |
| `npm.cmd run release:verify-windows` | 실패 | 산출물은 존재하지만 Authenticode 상태가 `NotSigned`이므로 release gate 실패 |
| 로컬 브라우저 smoke | 통과 | note CRUD+reload, task CRUD/toggle, fitness create/dashboard/delete+workout undo, Settings·Quick Capture fallback |
| App quality workflow | 구성 확인 | typecheck → test → build 순서. 원격 GitHub Actions run 결과는 별도 확인 대상 |
| 설치된 Windows runtime | 미검증 | tray·shortcut·autostart·installer 실행은 [#26](https://github.com/Yeon-sik/Always_Memo/issues/26) |
| 실제 Supabase·교차 앱 | 미검증 | migration/RLS/realtime/cross-device/CashOS fixture는 [#27](https://github.com/Yeon-sik/Always_Memo/issues/27) |

`NotSigned`는 빌드 실패가 아니라 배포 승인 실패다. 따라서 “NSIS를 만들 수 있음”과 “신뢰할 수 있게 서명·설치됨”을 분리해 기록한다.

## 6. 현재 한계와 다음 단계

| 우선순위 | 현재 한계 | 추적 |
| --- | --- | --- |
| P0 | 설치된 Windows 앱의 tray, 단축키, 자동 실행, 설치·제거를 실행하지 않음 | [#26 Windows installed-runtime 검증](https://github.com/Yeon-sik/Always_Memo/issues/26) |
| P0 | 운영 Supabase migration/RLS, 두 계정 격리, Realtime·다중 기기와 CashOS 동일 fixture 미검증 | [#27 Supabase·cross-repository 검증](https://github.com/Yeon-sik/Always_Memo/issues/27) |
| P0 | Auth session 초기화 예외가 local snapshot load보다 먼저 발생할 수 있음 | [#31 Auth 오류 시 local data 보존](https://github.com/Yeon-sik/Always_Memo/issues/31) |
| P1 | Fitness edit UI와 Life Report 공유가 완료되지 않음 | [#28 Fitness edit·Life Report](https://github.com/Yeon-sik/Always_Memo/issues/28) |
| P1 | 장기 persistence와 완료 기록 archive 정책이 정해지지 않음 | [#29 persistence·archive](https://github.com/Yeon-sik/Always_Memo/issues/29) |
| P2 | email/password 외 OAuth 흐름이 없음 | [#30 OAuth](https://github.com/Yeon-sik/Always_Memo/issues/30) |
| P2 | main bundle이 549.83 kB이며 size warning이 남음 | 실제 초기 로딩 측정 후 필요한 경우 route/feature 분할 |

지금 해야 하는 단 하나는 [#26](https://github.com/Yeon-sik/Always_Memo/issues/26)의 설치된 Windows runtime 검증이다. 이 단계가 끝나야 성공한 native build를 실제 desktop 동작 증거로 승격할 수 있다.

## 7. 관련 문서

- [README](../README.md)
- [Current Architecture ADR](./adr/2026-08-01-current-architecture.md)
- [Fitness Record Contract v1](./FITNESS_RECORD_CONTRACT_V1.md)
- [Release Readiness](./RELEASE_READINESS.md)
- [프로젝트 상세](./Project_Detail.md)
