# Codex Review Prompt

아래 내용을 Codex에게 그대로 붙여넣으세요.

```text
이 저장소는 Yeonsik’s Note입니다. 먼저 docs/plans/codex-start-here.md를 읽고, 이어서 docs/specs/codex-command-master.md, docs/plans/codex-implementation-roadmap.md, docs/plans/acceptance-checklist.md를 읽어주세요.

현재 목표는 단순 메모 앱을 Life Command Center로 승격하는 것입니다.

중요 조건:
1. Windows 데스크톱 Tauri 앱, Windows 웹 앱, Android 앱의 기존 동작을 깨지 마세요.
2. Tauri 전용 기능은 Rust #[cfg(desktop)]와 TypeScript dynamic import/fallback으로 분리하세요.
3. local-first를 유지하세요. Supabase 설정 또는 로그인 없이도 로컬 기능은 동작해야 합니다.
4. 삭제는 hard delete가 아니라 deletedAt tombstone으로 처리하세요.
5. useLocalSyncMemo.ts는 facade로 유지하고, 내부 책임만 단계적으로 분리하세요.
6. 먼저 Phase 1만 구현하세요. Phase 1은 recordAggregation.ts, Command Center shell, KPI card, calendar marker polish입니다.

작업 시작 전에 git status, App.tsx, useLocalSyncMemo.ts, src/features/records, src/features/fitness, src/lib/sync 구조를 확인하고 요약하세요.
작업 후 npm.cmd run build와 src-tauri에서 cargo check 결과를 보고하세요.
```
