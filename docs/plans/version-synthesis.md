# Version.md 기반 정리 — Life Command Center 전환 관점

## 1. 현재 제품 상태

Yeonsik’s Note는 Tauri v2 + React + TypeScript + Vite + Tailwind 기반 local-first 개인 기록 앱이다. 현재 기능은 메모, 체크리스트, 운동/식사/체중 기록, 날짜별 기록 조회, 설정, Supabase 선택 동기화, Tauri tray/close-to-hide/autostart를 포함한다.

## 2. 현재 탭 구조

```text
기록
메모
운동
설정
```

기존 문서에는 3탭 방향도 있었으나 실제 구현은 4탭이다. 결론은 `기록`을 제거하지 않고 앱 진입 홈인 Life Command Center로 승격하는 것이다.

## 3. 핵심 병목

`useLocalSyncMemo.ts`가 runtime config, localStorage, device, Supabase pull/push/realtime, heartbeat, autostart, notes/tasks/fitness CRUD를 모두 조율한다.

방향:

```text
대형 리팩토링 금지
useLocalSyncMemo.ts는 facade로 유지
도메인별 pure service와 sync merge부터 분리
```

## 4. 데이터/동기화 방향

현재 local-first와 Last Write Wins는 유지한다. 삭제는 `deletedAt` tombstone으로 보존해야 한다.

대상 snapshot:

```text
notes
tasks
workoutRecords
mealRecords
weightRecords
devices
```

## 5. 가장 먼저 닫아야 할 범위

```text
기록 탭 역할 확정
운동/식사/체중 수정/삭제 정책 확정
저장/동기화/날짜 계산 최소 테스트 추가
Supabase Auth/RLS 전환 계획 포함
```

## 6. 이번 workpack의 결론

V1의 제품 방향은 “새 기능 추가”가 아니라 “현재 넓어진 기능을 제품 수준으로 닫는 것”이다.
