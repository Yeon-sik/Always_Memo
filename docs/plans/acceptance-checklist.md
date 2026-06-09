# Acceptance Checklist — Yeonsik’s Note Life Command Center

## Product

- [ ] `기록` 탭이 앱의 홈이자 Life Command Center로 보인다.
- [ ] 첫 화면에서 오늘의 할 일, 생산성, 식단, 운동, 체중 상태가 보인다.
- [ ] 날짜 클릭 후 탭 이동 없이 주요 액션을 수행할 수 있다.
- [ ] `메모`, `운동`, `설정` 탭의 기존 핵심 동작이 유지된다.

## Data integrity

- [ ] 모든 selector가 `deletedAt !== null` row를 제외한다.
- [ ] 운동/식사/체중 삭제는 tombstone으로 기록된다.
- [ ] LWW 병합에서 최신 `updatedAt`이 이긴다.
- [ ] 동일 timestamp 충돌에서 tombstone이 이긴다.
- [ ] Supabase push/pull/realtime 경로에서 tombstone이 보존된다.

## Fitness CRUD

- [ ] 운동 기록 수정/삭제가 가능하다.
- [ ] 식사 기록 수정/삭제가 가능하다.
- [ ] 체중 기록 수정/삭제가 가능하다.
- [ ] `carbsGrams`, `fatGrams` 입력이 UI에 노출된다.
- [ ] 음수 nutrition 값이 저장되지 않는다.
- [ ] 0 이하 체중이 저장되지 않는다.

## Platform

- [ ] Windows Tauri에서 tray가 기존처럼 동작한다.
- [ ] Windows Tauri에서 Quick Capture가 등록 또는 실패 UX로 처리된다.
- [ ] browser dev server에서 Tauri API 부재로 crash하지 않는다.
- [ ] Android/mobile build path에서 desktop-only 코드가 compile path를 깨지 않는다.

## Security / Supabase

- [ ] Auth/RLS migration 또는 적용 계획이 포함된다.
- [ ] service_role key가 클라이언트 코드에 없다.
- [ ] local-only mode가 유지된다.
- [ ] manual User ID UI는 deprecated 또는 migration path가 명확하다.

## Build

- [ ] `npm.cmd run build` 통과.
- [ ] `src-tauri`에서 `cargo check` 통과.
- [ ] 테스트를 추가했다면 `npm.cmd run test` 통과.
- [ ] 새 문서/README가 실제 구현과 어긋나지 않는다.
