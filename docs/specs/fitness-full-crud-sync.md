# Spec — 운동 탭 Full CRUD & Tombstone Sync

## 1. 목적

운동/식사/체중 기록을 add-only 구조에서 완전한 데이터 수명 주기로 전환한다.

## 2. 노출해야 할 domain action

최종적으로 hook 또는 domain service에서 아래 액션을 제공한다.

```ts
addWorkoutRecord(input)
updateWorkoutRecord(id, patch)
deleteWorkoutRecord(id)

addMealRecord(input)
updateMealRecord(id, patch)
deleteMealRecord(id)

addWeightRecord(input)
updateWeightRecord(id, patch)
deleteWeightRecord(id)
```

`useLocalSyncMemo.ts`는 당분간 facade로 유지하되 내부 구현은 `src/features/fitness/fitnessService.ts`로 분리한다.

## 3. 삭제 정책

삭제는 hard delete가 아니라 tombstone이다.

```ts
record.deletedAt = nowIso();
record.updatedAt = nowIso();
record.deviceId = currentDeviceId;
```

UI에서는 즉시 사라지되 Supabase에는 tombstone이 push되어 다른 기기에도 삭제가 전파되어야 한다.

## 4. LWW 병합 정책

```text
updatedAt 최신 row가 이긴다.
같은 updatedAt이면 deletedAt !== null인 tombstone이 이긴다.
tombstone row는 local/pull/realtime merge에서 보존한다.
UI 목록, Markdown export, dashboard stats, calendar marker에서는 tombstone을 제외한다.
```

CRDT는 도입하지 않는다.

## 5. UI 명령

- 각 운동/식사/체중 row 우측에 subtle X 또는 trash icon 버튼을 추가한다.
- 삭제 hover에서만 muted red를 선명하게 만든다.
- 삭제는 즉시 반영하고 5초 undo toast를 우선 적용한다.
- row 클릭 또는 edit 버튼으로 inline edit mode에 진입한다.
- 식사 UI에 `carbsGrams`, `fatGrams` 입력을 활성화한다.
- 칼로리, 단백질, 탄수화물, 지방은 음수 불가.
- 체중은 0보다 큰 값만 허용.

## 6. 테스트

```text
fitnessService.test.ts
- updateWorkoutRecord가 updatedAt/deviceId를 갱신한다.
- deleteWorkoutRecord가 deletedAt tombstone을 만든다.
- delete 후 UI selector에서 제외된다.
- meal carbs/fat validation이 음수를 거부한다.
- weight validation이 0 이하를 거부한다.

merge.test.ts
- LWW
- 동일 timestamp에서 tombstone 우선
```
