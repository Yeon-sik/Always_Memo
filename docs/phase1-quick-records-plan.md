# Phase 1 Quick Records Plan

## 1. 현재 Quick Capture 흐름

현재 Quick Capture는 별도 데이터 모델을 갖고 있지 않다. 입력 패널은 사용자의 draft를 받아 `memo` 또는 `task`로 파싱한 뒤, 기존 메모/할 일 생성 함수에 위임한다.

확인한 코드 흐름:

- `src/app/App.tsx`
  - `useQuickCapture({ onAddMemo: memo.addNoteForDate, onAddTask: memo.addTask })`로 Quick Capture와 기존 저장 함수를 연결한다.
- `src/features/quick-capture/QuickCapturePanel.tsx`
  - textarea 입력을 받고 `onSave(draft, mode)`를 호출한다.
  - `Enter`는 저장, `Shift+Enter`는 줄바꿈이다.
  - 저장 성공 시 draft를 비운다.
- `src/features/quick-capture/quickCaptureParser.ts`
  - 지원 mode는 `task`, `memo` 두 개다.
  - 기본은 선택된 mode를 따른다.
  - draft가 `#memo`로 시작하면 선택 mode가 task여도 memo로 저장한다.
  - 빈 draft 또는 `#memo`만 있는 draft는 저장하지 않는다.
  - memo title은 첫 번째 non-empty line의 앞 40자를 사용한다.
- `src/features/quick-capture/useQuickCapture.ts`
  - 파싱 결과가 memo면 `onAddMemo(today, title, content)`를 호출한다.
  - 파싱 결과가 task면 `onAddTask(content, null, null, today)`를 호출한다.
  - task의 `plannedDate`는 오늘 날짜로 들어간다.
- `src/app/useLocalSyncMemo.ts`
  - `addNoteForDate`는 `createNoteEntity`로 note를 만들고 `notes` state에 추가한다.
  - `addTask`는 `createTaskEntity`로 task를 만들고 `tasks` state에 추가한다.
  - state 변경 후 기존 debounce 저장 흐름이 localStorage 저장과 Supabase push를 수행한다.

현재 저장 대상:

- memo 입력: `notes`
- task 입력: `tasks`
- Quick Capture 자체 원문 로그: 없음
- Quick Capture와 생성된 note/task의 연결 id: 없음

## 2. 현재 구조의 한계

현재 구조는 빠른 memo/task 입력에는 충분하다. 하지만 개인 OS의 도메인 연결 기준으로는 정보가 부족하다.

한계:

- 원문 입력 로그가 남지 않는다.
- Quick Capture에서 만든 note/task인지, 일반 UI에서 만든 note/task인지 구분하기 어렵다.
- 빠른 입력이 나중에 운동/식단/체중/금융 거래로 구조화되었는지 추적할 공통 필드가 없다.
- 운동 또는 금융처럼 구조화가 필요한 입력은 현재 memo/task 둘 중 하나로만 떨어진다.
- 도메인 row가 빠른 입력에서 생성되었는지 역추적할 기준이 없다.
- OS timeline이 notes/tasks/fitness/finance를 같은 방식으로 묶기 어렵다.

중요한 보존 원칙:

- 기존 Quick Capture memo/task 흐름은 삭제하지 않는다.
- 기존 `notes`, `tasks` 저장 방식은 유지한다.
- `quick_records`는 기존 기능을 대체하는 테이블이 아니라, 빠른 입력 원문과 도메인 연결 상태를 보존하는 상위 로그 계층으로 본다.

## 3. quick_records 정의

`quick_records`는 개인 OS에서 사용자가 빠르게 입력한 원문을 보존하는 core 도메인 테이블이다.

역할:

- 사용자가 입력한 원문 `raw_text`를 보존한다.
- 입력 출처를 기록한다. 예: `memo_os`, `fitness_app`, `finance_hub`
- 빠른 기록이 어떤 도메인 row로 구조화되었는지 연결한다.
- 도메인 row가 빠른 기록에서 만들어졌는지 추적할 수 있게 한다.
- OS activity timeline의 원본 이벤트 중 하나가 된다.

`quick_records`는 기존 memo/task의 확장이 아니라 별도 원문 로그 테이블로 두는 방향이 더 안전하다.

비교:

| 선택지 | 장점 | 단점 | 판단 |
| --- | --- | --- | --- |
| 기존 memo/task 확장 | 구현이 작고 기존 UI 재사용이 쉽다 | 운동/금융/체중/식단 원문을 notes/tasks에 억지로 넣게 된다. 도메인 연결 규칙이 흐려진다 | 단기 편하지만 개인 OS 확장에는 부적합 |
| 별도 `quick_records` 테이블 | 원문 로그, 연결 상태, source app을 공통으로 다룰 수 있다 | 새 테이블, sync, UI 연결이 필요하다 | Phase 1 이후 구현 기준으로 적합 |

권장 정의:

- `quick_records`는 core 계층이다.
- `notes`, `tasks`, `workout_sessions`, `meals`, `body_metrics`, `finance_transactions`는 각 도메인 원본 row다.
- 빠른 입력에서 도메인 row가 생성되면 양쪽에 연결 id를 남긴다.

## 4. 데이터 소유권

OS/MemoNote 소유:

- `quick_records`
- 기존 `notes`
- 기존 `tasks`
- Quick Capture 입력 UX
- activity timeline에서 빠른 기록을 보여주는 규칙

Fitness 앱 소유:

- `workout_sessions`
- `workout_exercises`
- `workout_sets`
- `body_metrics`
- `meals`
- 운동/식단/체중의 세부 생성, 수정, 삭제

Finance Hub 소유:

- `finance_accounts`
- `finance_assets`
- `finance_holdings`
- `finance_transactions`
- `finance_snapshots`
- 금융 거래와 자산의 세부 생성, 수정, 삭제

OS가 하지 않을 일:

- 운동 세트별 무게/반복 수 직접 수정
- 금융 거래 상세 수정
- 도메인 앱의 검증 로직 소유
- 도메인 테이블을 notes/tasks처럼 직접 편집하는 UI 제공

## 5. 연결 규칙

공통 연결 규칙:

- `quick_record`는 원문 입력의 기준 row다.
- 도메인 row는 실제 구조화된 원본 데이터다.
- `quick_record.linked_entity_type`은 연결된 도메인 타입을 저장한다.
- `quick_record.linked_entity_id`는 연결된 도메인 row id를 저장한다.
- 도메인 row에는 `created_from_quick_record_id`를 둔다.
- 원본 빠른 기록은 삭제하지 않는다.
- 빠른 기록이 잘못 구조화되면 연결만 해제하거나 새 도메인 row로 재연결한다.
- 도메인 row가 soft delete되어도 quick record 원문은 남긴다.

quick_record -> note/task:

- 빠른 메모는 기존처럼 note를 생성한다.
- 빠른 할 일은 기존처럼 task를 생성한다.
- 구현 단계에서는 note/task row에 `created_from_quick_record_id`를 추가할지 결정해야 한다.
- 최소 연결은 quick record가 `linked_entity_type = note|task`, `linked_entity_id = created note/task id`를 갖는 방식이다.

quick_record -> workout_session / meal / body_metric:

- 운동 기록 원문은 먼저 quick record로 저장한다.
- Fitness 앱에서 구조화할 때 `workout_sessions`, `meals`, `body_metrics` 중 적절한 row를 만든다.
- 생성된 도메인 row는 `created_from_quick_record_id`를 가진다.
- quick record는 `linked_entity_type = workout_session|meal|body_metric`, `linked_entity_id = domain id`를 가진다.

quick_record -> finance_transaction:

- 금융 거래 원문은 먼저 quick record로 저장한다.
- Finance Hub에서 계좌, 자산, 금액, 거래 유형을 확정한다.
- 생성된 `finance_transactions` row는 `created_from_quick_record_id`를 가진다.
- quick record는 `linked_entity_type = finance_transaction`, `linked_entity_id = transaction id`를 가진다.

domain row -> created_from_quick_record_id:

- 빠른 기록에서 만들어진 도메인 row만 값을 가진다.
- 도메인 앱에서 직접 입력한 row는 null일 수 있다.
- OS timeline은 `created_from_quick_record_id`가 없어도 도메인 row를 조회할 수 있어야 한다.

## 6. 최소 필드

권장 최소 필드:

| 필드 | 역할 |
| --- | --- |
| `id` | quick record 고유 id |
| `user_id` | 사용자 스코프. 현재 앱은 config 기반 user id를 사용한다 |
| `raw_text` | 사용자가 입력한 원문 |
| `record_type` | 빠른 기록의 1차 분류. 예: `memo`, `task`, `workout`, `meal`, `body_metric`, `finance`, `unknown` |
| `source_app` | 입력한 앱. 예: `memo_os`, `fitness_app`, `finance_hub` |
| `device_id` | 입력 기기 |
| `linked_entity_type` | 연결된 도메인 타입. 연결 전에는 null |
| `linked_entity_id` | 연결된 도메인 row id. 연결 전에는 null |
| `created_at` | 원문 입력 시각 |
| `updated_at` | 연결 상태 또는 soft delete 변경 시각 |
| `deleted_at` | soft delete tombstone |

추후 검토 필드:

- `parsed_payload`: 자동/수동 파싱 결과를 JSON으로 임시 보관할지 여부
- `parse_status`: `unparsed`, `linked`, `ignored`, `needs_review`
- `confidence`: 자동 분류를 도입할 경우 신뢰도
- `source_context`: shortcut, tray, mobile widget 등 입력 경로

MVP에서는 최소 필드만 먼저 설계하고, 자동 파싱 관련 필드는 구현을 늦춘다.

## 7. 기록 예시

빠른 메모:

```text
raw_text: "회의 메모\n다음 주까지 운동 앱 DB 초안 정리"
record_type: memo
source_app: memo_os
linked_entity_type: note
linked_entity_id: notes.id
```

결과:

- `quick_records`에 원문 저장
- `notes`에 기존 메모 생성
- quick record와 note 연결

빠른 할 일:

```text
raw_text: "오늘 운동 앱 quick_records 문서 검토"
record_type: task
source_app: memo_os
linked_entity_type: task
linked_entity_id: tasks.id
```

결과:

- `quick_records`에 원문 저장
- `tasks`에 오늘 planned task 생성
- quick record와 task 연결

운동 기록:

```text
raw_text: "벤치프레스 60kg 5세트"
record_type: workout
source_app: memo_os
linked_entity_type: workout_session
linked_entity_id: workout_sessions.id
```

결과:

- OS에서 원문 quick record 저장
- Fitness 앱에서 `workout_sessions`, `workout_exercises`, `workout_sets`로 구조화
- `workout_sessions.created_from_quick_record_id = quick_records.id`

식단 기록:

```text
raw_text: "점심 닭가슴살 샐러드 450kcal 단백질 35g"
record_type: meal
source_app: memo_os
linked_entity_type: meal
linked_entity_id: meals.id
```

결과:

- OS에서 원문 quick record 저장
- Fitness 앱에서 `meals` row 생성
- 사진 없이 텍스트와 수동 영양값만 저장

체중 기록:

```text
raw_text: "오늘 체중 73.4kg"
record_type: body_metric
source_app: memo_os
linked_entity_type: body_metric
linked_entity_id: body_metrics.id
```

결과:

- OS에서 원문 quick record 저장
- Fitness 앱 또는 OS summary 연결 단계에서 `body_metrics` row 생성
- 기존 체중 빠른 기록 흐름과 충돌하지 않게 연결만 추가

금융 거래 기록:

```text
raw_text: "업비트 BTC 10만원 매수"
record_type: finance
source_app: memo_os
linked_entity_type: finance_transaction
linked_entity_id: finance_transactions.id
```

결과:

- OS에서 원문 quick record 저장
- Finance Hub에서 계좌, 자산, 거래 유형, 금액을 확정
- `finance_transactions.created_from_quick_record_id = quick_records.id`

## 8. 구현 전 결정 질문

반드시 결정해야 할 것:

- Quick Capture 저장 시 항상 quick record를 먼저 만들 것인가, 아니면 memo/task는 당분간 기존 흐름을 유지하고 도메인 기록부터 quick record를 만들 것인가?
- `notes`와 `tasks`에도 `created_from_quick_record_id`를 추가할 것인가?
- `quick_records.record_type` 값을 사용자가 직접 고르게 할 것인가, parser가 추론하게 할 것인가?
- MVP에서 지원할 record type은 `memo`, `task`, `workout`, `meal`, `body_metric`, `finance`, `unknown` 중 어디까지인가?
- `linked_entity_type`은 문자열 enum으로 관리할 것인가?
- quick record가 여러 도메인 row와 연결될 가능성을 허용할 것인가? 예: 운동 세션 1개 + 세트 여러 개
- linked entity를 1개만 둘지, 별도 junction table을 둘지 결정해야 한다.
- 기존 `workout_records`, `meal_records`, `weight_records`를 새 fitness 테이블로 옮길지, 당분간 호환 계층으로 유지할지 결정해야 한다.
- Supabase Auth/RLS 전환 전에 `user_id`는 기존 config string 전략을 유지할 것인가?
- localStorage snapshot에 quick records를 포함할 것인가, 아니면 Supabase 전용으로 둘 것인가?
- offline 상태에서 quick_records를 만들고 나중에 sync할 것인가?

권장 초기 결정:

- Phase 1에서는 quick record를 별도 원문 로그로 정의만 한다.
- 구현 시에는 memo/task 기존 흐름을 유지하면서 quick record 생성만 추가하는 방식이 가장 작다.
- linked entity는 MVP에서 1개만 허용한다.
- 다중 연결은 `activity_events` 또는 junction table이 필요해질 때 재검토한다.

## 9. 권장 구현 순서

1. 문서 확정

- 이 문서에서 `quick_records`의 역할, 필드, 연결 규칙을 확정한다.
- 코드와 DB는 아직 수정하지 않는다.

2. 현재 Quick Capture 회귀 기준 작성

- memo mode 저장
- task mode 저장
- `#memo` prefix 저장
- 빈 입력 reject
- 오늘 planned task 생성

3. quick_records 타입 설계

- TypeScript 타입 초안을 먼저 작성한다.
- 기존 `Note`, `Task`와 같은 audit field 규칙을 맞춘다.
- 이 단계에서도 DB migration은 별도 작업으로 둔다.

4. DB migration 설계

- `quick_records` 테이블만 작게 추가한다.
- 기존 테이블 변경은 후순위로 둔다.
- note/task에 `created_from_quick_record_id`를 추가할지는 별도 결정 후 진행한다.

5. local-first 저장 확장

- localStorage snapshot에 `quickRecords`를 추가한다.
- 기존 snapshot parser의 하위 호환을 유지한다.
- 기존 notes/tasks 로딩이 깨지지 않아야 한다.

6. Supabase sync 확장

- `quick_records` pull/push/realtime을 추가한다.
- 기존 notes/tasks/workout/meal/weight sync 로직은 유지한다.
- soft delete, `updated_at`, `device_id`, `user_id` 규칙을 맞춘다.

7. Quick Capture 저장 경로 확장

- 저장 시 quick record를 먼저 만들고, 기존 memo/task 생성 결과와 연결한다.
- 저장 실패 시 기존 memo/task 입력이 막히지 않도록 실패 처리 전략을 정한다.

8. 도메인 앱 연결

- Fitness 앱이 `created_from_quick_record_id`를 사용해 workout/meal/body metric을 만든다.
- Finance Hub가 `created_from_quick_record_id`를 사용해 transaction을 만든다.
- OS는 도메인 row를 직접 수정하지 않고 summary/timeline으로 조회한다.

9. timeline/summary 연결

- quick record와 도메인 row를 함께 조회하는 timeline 규칙을 만든다.
- 중복 노출 방지 규칙을 정한다. 예: linked quick record와 domain event를 하나의 timeline item으로 합성한다.

10. 검증

- 기존 memo/task Quick Capture 동작 회귀 테스트
- offline 저장 후 online sync
- 다른 기기 realtime 반영
- linked quick record가 domain row와 함께 timeline에 표시되는지 확인
