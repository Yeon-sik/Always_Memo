# Personal OS | 메모·할 일·건강·금융 요약을 연결하는 로컬 우선 개인 관제 앱

> Personal OS는 빠른 기록을 로컬에서 즉시 처리하고, 온라인일 때 Supabase와 동기화하며, Fitness App과 CashOS의 상세 데이터를 요약 형태로 모으는 Windows 중심 개인 관제 애플리케이션이다.

| 항목 | 내용 |
| --- | --- |
| 프로젝트 형태 | 개인 프로젝트 |
| 담당 범위 | 제품 구조, React UI, 로컬 저장, Supabase 동기화, Tauri 네이티브 기능 |
| 현재 상태 | 1.0 코드 후보, 로컬 테스트·웹 빌드 통과, 설치·운영 배포 게이트 미검증 |
| 문서 기준 | `60f2d675ab4a` 기반 `feat/personal_os` dirty working tree |
| 주요 기술 | React, TypeScript, Vite, Tauri v2, Supabase, Vitest |
| Repository | [Yeon-sik/Always_Memo](https://github.com/Yeon-sik/Always_Memo) |
| 상세 문서 | [Project_Detail.md](./Project_Detail.md) |

## 1. 30초 요약

- **문제**: 메모·할 일·운동·식사·체중·금융 기록이 여러 앱에 흩어지면 하루 상태를 판단하기 어렵고, 네트워크 실패가 입력을 막을 수 있다.
- **해결**: 로컬 저장을 우선하고, 기능 모듈별 기록을 하나의 타임라인·캘린더·빠른 입력 흐름에 모은 뒤 Supabase로 pull·push·realtime 동기화한다.
- **현재 결과**: 메모, 체크리스트, 전역 단축키 빠른 기록, fitness 기록·요약, CashOS 금융 일별 요약 조회, 트레이·자동 시작 코드가 구현돼 있다.
- **검증 경계**: 2026-07-27 32개 테스트와 TypeScript/Vite 빌드는 통과했지만 Tauri 설치 파일, Authenticode, 운영 RLS, 실제 사용자 환경은 이번 작업에서 검증하지 않았다.

## 2. 문제와 해결

| 사용자 문제 | 해결 방식 | 현재 근거 |
| --- | --- | --- |
| 앱을 열고 분류하는 과정이 기록을 방해한다 | 전역 단축키와 quick capture parser로 메모·할 일을 빠르게 만든다 | `src/features/quick-capture`, `src-tauri/src/lib.rs` |
| 오프라인에서 입력이 막힐 수 있다 | local storage adapter를 먼저 사용하고 sync client를 교체 가능하게 둔다 | `src/lib/storage`, `src/lib/sync` |
| 운동 상세와 OS 요약 책임이 섞인다 | 공통 운동 parent summary만 표시하고 상세 종목·세트는 Fitness App이 소유한다 | `src/features/fitness`, `docs/FITNESS_RECORD_CONTRACT_V1.md` |
| 금융 앱 내부 테이블에 결합될 수 있다 | 인증 후 `finance_summary_daily` 뷰만 기간 조회한다 | `src/features/finance`, `src/lib/sync/supabaseSyncClient.ts` |

## 3. 핵심 기능과 결과

| 영역 | 구현 결과 | 검증 수준 |
| --- | --- | --- |
| 메모·할 일 | 로컬 CRUD, soft delete, 일정 필드, 목록 UI | 저장소·단위 테스트 |
| 빠른 기록 | 패널, 파서, 전역 단축키, tray 진입 | 저장소·파서 테스트 |
| 기록 캘린더 | 운동·식사·체중·금융 요약의 날짜별 표시 | 저장소·집계 테스트 |
| Fitness 연결 | 공통 record contract, 요약·통계·내보내기 | 저장소·단위 테스트 |
| CashOS 연결 | 인증된 일별 금융 요약 조회와 캘린더 표시 | 저장소·단위 테스트, 운영 미검증 |
| 동기화 | local-only fallback, pull, push, realtime, 계정 바인딩 | 저장소·단위 테스트, 운영 미검증 |
| Windows 통합 | Tauri tray, autostart, global shortcut, NSIS 설정 | 저장소 검증, 이번 작업에서 설치 파일 미빌드 |

## 4. 핵심 사용 흐름

```text
앱 또는 전역 단축키 실행
  → 로컬 기록 즉시 생성·표시
  → 기능별 목록·캘린더·요약 갱신
  → 로그인·온라인 상태 확인
  → Supabase pull / push / realtime
  → Fitness App·CashOS 데이터는 요약 경계로 통합
```

## 5. 검증 현황

| 검증 항목 | 상태 | 확인일 | 근거 |
| --- | --- | --- | --- |
| Vitest | 7개 파일, 32개 테스트 통과 | 2026-07-27 | `npm.cmd test -- --run` |
| TypeScript·Vite 빌드 | 통과 | 2026-07-27 | `npm.cmd run build` |
| Tauri·NSIS 빌드 | 이번 작업에서 미실행 | 2026-07-27 | Rust·Windows 설치 파일 별도 검증 필요 |
| Authenticode 서명 | 미검증 | 2026-07-27 | 서명 인증서 필요 |
| 운영 Supabase·RLS | 미검증 | 2026-07-27 | linked migration과 두 계정 격리 필요 |
| 실사용 동기화 | 미검증 | 2026-07-27 | 두 기기·교차 앱 테스트 필요 |

웹 빌드는 성공했지만 minified JavaScript의 500 kB 초과 chunk 경고가 남아 있다.

## 6. 현재 한계와 다음 단계

- **현재 한계**: 로컬 테스트와 웹 번들 성공은 Windows 설치 파일, 운영 DB, 서명, 실제 동기화를 증명하지 않는다.
- **문서 부채**: README의 일부 과거 보안 설명은 현재 Auth/RLS 코드와 맞지 않으므로 공개 전 정리가 필요하다.
- **지금 해야 하는 한 단계**: 운영 Supabase에서 두 계정 격리와 Fitness App 완료 세션·CashOS 일별 요약을 한 계정으로 조회하는 통합 테스트를 실행한다.
- **범위 밖**: 파일 첨부, CRDT, 자동 업데이트, 의료 판단은 현재 완료 범위가 아니다.

## 7. 관련 문서

- [README](../README.md)
- [Fitness Record Contract v1](./FITNESS_RECORD_CONTRACT_V1.md)
- [Release Readiness](./RELEASE_READINESS.md)
- [프로젝트 상세](./Project_Detail.md)
