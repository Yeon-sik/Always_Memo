# Personal OS | 기록·할 일·생활 데이터를 한곳에서 관리하는 로컬 우선 데스크톱 앱

> Personal OS는 메모, 체크리스트, 빠른 기록, 운동·식단·체중 기록을 로컬에서 즉시 저장하고 필요할 때 Supabase와 동기화하는 Tauri 기반 Windows 앱이다.

| 항목 | 내용 |
| --- | --- |
| 프로젝트 형태 | 개인 프로젝트 |
| 담당 범위 | 제품 설계, React UI, local-first 저장, Supabase sync, Tauri 통합 |
| 현재 상태 | MVP |
| 문서 기준 | `main` 기준 앱 커밋 `60f2d675ab4a70e2b8462538f81ac8eda836a947` |
| 주요 기술 | React, TypeScript, Vite, Tauri, Supabase, Vitest |
| Demo | 공개 배포 미검증 |
| Repository | [Yeon-sik/Always_Memo](https://github.com/Yeon-sik/Always_Memo) |
| 상세 문서 | [Project_Detail.md](./Project_Detail.md) |

## 1. 30초 요약

- **문제**: 메모, 할 일, 빠른 기록과 생활 데이터가 여러 앱에 흩어지면 기록 속도와 맥락 연결이 떨어진다.
- **해결**: 기능별 모듈을 하나의 React 앱에 조립하고 localStorage를 기본 저장소, Supabase를 선택적 동기화 경계로 사용한다.
- **핵심 결과**: `main`에서 5파일 24테스트와 TypeScript·Vite 프로덕션 빌드가 통과했다.
- **기술적 차별점**: Tauri tray·global shortcut·autostart와 local-first UI를 연결해 Windows 상시 기록 도구로 구성했다.

## 2. 문제와 해결

| 사용자 문제 | 해결 방식 | 확인된 가치 |
| --- | --- | --- |
| 생각을 앱 화면까지 이동해 입력하는 비용이 크다 | tray와 global shortcut 기반 quick capture | 기록 진입 단계 축소 |
| 오프라인에서 기록을 잃으면 안 된다 | localStorage adapter 우선 저장 | 네트워크 없이 기본 CRUD 유지 |
| 여러 기기에서 데이터가 달라질 수 있다 | Supabase pull·push·Realtime 경계 | 설정 시 원격 동기화 가능 구조 |
| 기록 종류별 맥락이 분리된다 | 메모·할 일·기록 캘린더·fitness 모듈 | 한 앱에서 날짜별 생활 기록 확인 |

## 3. 핵심 기능과 결과

| 영역 | 구현 결과 | 근거 |
| --- | --- | --- |
| 메모·할 일 | CRUD, soft delete, 날짜·순서 관리 | `src/features/notes`, `tasks` |
| 빠른 기록 | 텍스트 파싱, overlay, desktop shortcut | `src/features/quick-capture`, `src-tauri` |
| 생활 기록 | 운동·식단·체중 기록과 집계·내보내기 | `src/features/fitness`, `records` |
| 동기화 | local-only 또는 Supabase pull/push/realtime | `src/lib/sync` |
| 품질 | 5파일 24테스트, 웹 빌드 통과 | 2026-07-27 로컬 검증 |

## 4. 담당 범위와 기여

- **제품**: 개인 기록을 메모·할 일·생활 데이터로 묶는 범위 정의
- **프론트엔드**: 기능 모듈, 기록 캘린더, quick action UI 구현
- **데이터**: localStorage adapter, sync client, Supabase row mapping 구성
- **데스크톱**: Tauri tray, autostart, global shortcut, close-to-hide 경계 구성
- **문서/자동화**: Git Markdown 기반 Notion 미러와 검증 워크플로 구성

## 5. 핵심 사용자 흐름

```text
tray 또는 단축키
  → 빠른 기록 입력
  → 로컬 즉시 저장
  → 기능별 목록·캘린더 갱신
  → 설정된 경우 Supabase 동기화
```

## 6. 핵심 기술적 판단

### local-first와 sync-later를 분리한다

- **상황**: 개인 기록은 원격 응답을 기다리지 않고 저장되어야 한다.
- **선택**: storage adapter와 sync client를 분리하고 local-only 구현을 기본 fallback으로 둔다.
- **결과**: Supabase 설정이 없어도 앱의 기본 기록 기능이 유지된다.
- **남은 비용**: 운영 다중 기기 충돌, migration, RLS는 실제 환경 검증이 필요하다.

## 7. 검증 현황

| 검증 항목 | 상태 | 마지막 확인 | 근거 |
| --- | --- | --- | --- |
| 단위 테스트 | 5파일 24테스트 통과 | 2026-07-27 | `npm.cmd test -- --run` |
| TypeScript·Vite 빌드 | 통과, 500 kB 초과 chunk 경고 | 2026-07-27 | `npm.cmd run build` |
| 의존성 감사 | high 2건 남음 | 2026-07-27 | `npm.cmd ci` |
| Tauri·NSIS 빌드 | 미실행 | 2026-07-27 | 이번 검증 범위 밖 |
| 운영 Supabase·RLS | 미검증 | 2026-07-27 | migration·코드 존재만 확인 |
| Windows 실제 사용 | 미검증 | 2026-07-27 | 설치·tray·shortcut E2E 미실행 |

## 8. 현재 한계와 다음 단계

- **현재 한계**: 운영 Supabase 격리, Tauri 설치 파일, 실제 Windows shortcut 흐름이 이번 기준에서 검증되지 않았다.
- **다음 한 단계**: high 의존성 2건의 도달 가능성과 안전한 업그레이드 경로를 확인한다.
- **하지 않는 것**: 파일 첨부, CRDT, 자동 업데이트는 현재 완료 범위가 아니다.

## 9. 관련 문서

- [Project Detail](./Project_Detail.md)
- [README](../README.md)
- [Life Command Center Spec](./specs/life-command-center.md)
- [Auth and RLS Spec](./specs/auth-rls-share.md)
