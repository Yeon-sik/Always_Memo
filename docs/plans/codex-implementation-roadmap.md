# Plan — Codex Implementation Roadmap

## Phase 0 — Repository reconnaissance

목표: 구현 전 실제 파일과 import 관계를 확인한다.

```powershell
git status --short
Get-ChildItem .\src\features -Recurse -Depth 2
Get-ChildItem .\src\lib -Recurse -Depth 2
Get-Content .\src\app\App.tsx -TotalCount 220
Get-Content .\src\app\useLocalSyncMemo.ts -TotalCount 260
```

산출물:

```text
현재 import graph 요약
legacy component 사용 여부 판단
Phase 1 변경 범위 제안
```

## Phase 1 — Command Center shell & aggregation

```text
기록 탭 이름/역할을 Life Command Center로 확정
recordAggregation.ts pure selectors 작성
Dashboard Hero + KPI card + chart shell 추가
캘린더 marker legend 정리
```

검증:

```powershell
npm.cmd run build
```

## Phase 2 — Inline Quick Actions

```text
날짜 클릭 overlay/sheet 구현
할 일 완료 toggle
quick task add
memo quick add/edit
weight edit
keyboard/focus/Esc 처리
```

검증:

```powershell
npm.cmd run build
```

## Phase 3 — Fitness Full CRUD

```text
fitnessService.ts 작성
update/delete domain action 추가
FitnessPanel row edit/delete UI 추가
carbs/fat inputs 활성화
undo toast MVP
LWW/tombstone merge 테스트 추가
```

검증:

```powershell
npm.cmd run build
npm.cmd run test
```

테스트 스크립트가 없으면 Vitest 추가 여부를 먼저 제안하고 승인 후 진행한다.

## Phase 4 — Desktop Quick Capture

```text
platform capabilities 추가
desktop quickCapture/shortcut wrapper 추가
src-tauri global-shortcut plugin desktop-only 초기화
quick-capture window 구현
tray menu 확장
web/Android fallback 연결
```

검증:

```powershell
npm.cmd run build
Push-Location .\src-tauri
cargo check
Pop-Location
npm.cmd run tauri:dev
```

## Phase 5 — Auth/RLS & Share MVP

```text
Auth session layer 추가
schema/migration 초안 정리
RLS policy 검토
Life Report text generator
clipboard/share intent fallback 구현
```

검증:

```powershell
npm.cmd run build
```

Supabase live 적용은 별도 승인 후 진행한다.
