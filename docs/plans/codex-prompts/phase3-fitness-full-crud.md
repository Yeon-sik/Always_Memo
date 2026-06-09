Phase 3를 수행하세요.

목표:
운동/식사/체중 기록을 add-only 구조에서 Full CRUD 구조로 전환하고, 삭제는 hard delete가 아니라 deletedAt tombstone으로 처리합니다. 기록 탭, 운동 탭, 동기화, export, 통계에서 deletedAt !== null 항목은 제외되어야 합니다.

반드시 먼저 확인:
1. git status --short
2. docs/plans/codex-start-here.md
3. docs/specs/fitness-full-crud-sync.md
4. docs/specs/record-aggregation-api.md
5. src/types/entities.ts
6. src/app/useLocalSyncMemo.ts
7. src/features/fitness/FitnessPanel.tsx
8. src/lib/sync 또는 Supabase mapper/merge 관련 파일
9. Phase 1~2에서 추가된 recordAggregation 및 Quick Action 관련 파일

구현 범위:
1. 운동 기록 update/delete 구현
2. 식사 기록 update/delete 구현
3. 체중 기록 update/delete 구현
4. FitnessPanel에 운동/식사/체중 row별 edit/delete UI 연결
5. 식사 입력 UI에 carbsGrams, fatGrams 활성화
6. carbsGrams/fatGrams inline edit 지원
7. 삭제 시 deletedAt = nowIso(), updatedAt = nowIso(), deviceId = currentDeviceId
8. UI 목록/통계/export/calendar marker/dashboard에서 tombstone 제외
9. 5초 undo toast 또는 최소 undo 가능한 local rollback 구조 구현
10. LWW merge에서 같은 updatedAt이면 tombstone 우선
11. useLocalSyncMemo.ts는 facade로 유지하고, 가능한 경우 fitnessService.ts / fitnessStats.ts로 작은 단위 분리

권장 파일:
- src/features/fitness/fitnessService.ts
- src/features/fitness/fitnessStats.ts
- src/features/fitness/fitnessValidation.ts
- src/features/fitness/FitnessPanel.tsx
- src/lib/sync/merge.ts
- src/lib/sync/supabaseMappers.ts
- src/features/records/recordAggregation.ts
- 필요 시 src/app/useLocalSyncMemo.ts에는 얇은 action wrapper만 추가

필수 액션 형태:
updateWorkoutRecord(id, patch)
deleteWorkoutRecord(id)
updateMealRecord(id, patch)
deleteMealRecord(id)
updateWeightRecord(id, patch)
deleteWeightRecord(id)

삭제 정책:
- hard delete 금지
- 배열에서 즉시 제거처럼 보이게 할 수는 있지만 실제 snapshot에는 tombstone 보존
- remote push/pull/realtime merge에서 tombstone이 사라지면 안 됨
- markdown export와 dashboard stats에는 tombstone 제외

검증:
1. npm.cmd run build
2. src-tauri에서 cargo check
3. test script가 있으면 npm.cmd run test
4. test script가 없으면 Vitest 최소 도입을 검토하고 pure function 테스트 추가
5. 수동 테스트:
   - 운동 기록 생성/수정/삭제
   - 식사 기록 생성/수정/삭제
   - carbs/fat 입력 및 수정
   - 체중 기록 생성/수정/삭제
   - 삭제 후 기록 탭 dot marker에서 사라짐
   - 삭제 후 export/통계에서 제외
   - undo 가능 시 undo 정상 복구

금지:
1. CRDT 도입 금지
2. Supabase Auth/RLS는 Phase 5로 미룸
3. Global Hotkey는 Phase 4로 미룸
4. localStorage를 IndexedDB/SQLite로 전환하지 말 것
5. Android/web에서 깨지는 Tauri API import 금지

작업 후 보고:
- 변경 파일 목록
- 구현 기능
- tombstone 처리 방식
- 추가한 테스트
- 실행한 검증 명령과 결과
- 남은 리스크
