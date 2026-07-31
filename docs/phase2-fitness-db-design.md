# Phase 2 Fitness DB Design

## 1. Purpose

이 문서는 개인 OS 확장 로드맵의 Phase 2 기준 설계안이다. 목표는 Android 전용 Fitness 앱 MVP가 사용할 DB 도메인을 정의하고, 기존 MemoNote/OS가 가진 운동, 식단, 체중 기록과 충돌하지 않는 연결 기준을 정하는 것이다.

이 문서는 구현 문서가 아니다.

- 코드 수정 없음
- DB/schema 수정 없음
- migration 작성 없음
- 기존 fitness 기록 삭제 없음
- 기존 OS 기록 화면 리팩토링 제안 없음

## 2. Current Fitness Snapshot

현재 MemoNote에는 이미 fitness 성격의 세 테이블과 타입이 있다.

현재 테이블:

- `workout_records`: 일자별 운동 기록. `workout_type`, `category`, `exercise_name`, cardio용 `duration_seconds`, `average_heart_rate`를 가진다.
- `meal_records`: 일자별 식단 기록. `menu`, `calories`, `protein_grams`, 선택값 `carbs_grams`, `fat_grams`를 가진다.
- `weight_records`: 일자별 체중 기록. `weight_kg`를 가진다.

현재 앱 흐름:

- `src/features/fitness/fitnessService.ts`가 workout/meal/weight 엔티티 생성, 수정, 삭제를 담당한다.
- `src/app/useLocalSyncMemo.ts`가 local-first 상태 저장, Supabase pull/push/realtime을 조율한다.
- `src/features/records/recordAggregation.ts`가 일자별 기록, 달력 마커, 평균 칼로리, 평균 단백질, 체중 변화 등을 계산한다.
- `src/types/entities.ts`의 `LocalDataSnapshot`에는 `workoutRecords`, `mealRecords`, `weightRecords`가 포함된다.
- `supabase/schema.sql`에는 `workout_records`, `meal_records`, `weight_records`가 있고, 모두 `user_id`, `device_id`, `updated_at`, `deleted_at` 기반 sync 규칙을 따른다.

현재 구조의 장점:

- OS 기록 화면에서 바로 조회하기 쉽다.
- local-first와 Supabase sync에 이미 연결되어 있다.
- 일자별 운동/식단/체중 기록 MVP로는 충분하다.

현재 구조의 한계:

- 운동 세션 단위가 없다.
- 한 세션 안의 여러 운동 종목을 표현하기 어렵다.
- 세트별 무게, 반복 수, 완료 여부를 저장할 수 없다.
- 루틴, 진행 중인 운동, 세트 기록 UI를 만들기 어렵다.
- Android Fitness 앱의 원본 데이터 모델로 쓰기에는 너무 평면적이다.

## 3. Design Direction

Fitness 도메인은 기존 세 테이블을 즉시 대체하지 않는다. 새 Fitness 앱 MVP는 세션 중심 구조를 원본 데이터로 사용하고, 기존 테이블은 OS 호환 또는 요약 계층으로 유지한다.

핵심 방향:

- Android Fitness 앱은 세부 기록의 원본 소유자다.
- OS/MemoNote는 오늘 운동 여부, 최근 운동, 주간 요약, 최근 식단, 최근 체중만 조회한다.
- 세부 생성/수정/삭제는 Fitness 앱에서 한다.
- OS는 세트별 무게, 반복 수, 운동 루틴 상세를 직접 수정하지 않는다.
- 기존 `workout_records`, `meal_records`, `weight_records`는 당장 삭제하지 않는다.
- 새 테이블은 `workout_sessions`, `workout_exercises`, `workout_sets`, `body_metrics`, `meals`를 기준 후보로 둔다.
- 빠른 기록에서 시작된 구조화 기록은 Phase 1의 `created_from_quick_record_id` 규칙을 따른다.

## 4. Proposed Fitness Tables

### workout_sessions

운동 1회 단위의 원본 row다. Android Fitness MVP의 최상위 운동 기록이다.

역할:

- 오늘 운동했는지 판단한다.
- 한 번의 운동 시작/종료, 메모, 상태를 담는다.
- 여러 `workout_exercises`를 가진다.

주요 필드 후보:

| 필드 | 역할 |
| --- | --- |
| `id` | session id |
| `user_id` | 사용자 스코프 |
| `date` | 운동 날짜 |
| `started_at` | 시작 시각 |
| `ended_at` | 종료 시각, 진행 중이면 null 가능 |
| `status` | `planned`, `in_progress`, `completed`, `cancelled` |
| `session_type` | `strength`, `cardio`, `mixed`, `other` |
| `title` | 사용자가 보는 세션 이름 |
| `memo` | 세션 메모 |
| `created_from_quick_record_id` | quick_records 연결 |
| `device_id` | 생성/수정 기기 |
| `created_at` | 생성 시각 |
| `updated_at` | 수정 시각 |
| `deleted_at` | soft delete |

### workout_exercises

세션 안의 운동 종목 row다.

역할:

- 벤치프레스, 스쿼트, 러닝 같은 운동 종목을 저장한다.
- 한 세션 안에서 운동 순서를 관리한다.
- 여러 `workout_sets`를 가진다.

주요 필드 후보:

| 필드 | 역할 |
| --- | --- |
| `id` | exercise row id |
| `user_id` | 사용자 스코프 |
| `session_id` | `workout_sessions.id` |
| `order_index` | 세션 내 운동 순서 |
| `exercise_name` | 운동명 |
| `category` | 가슴, 등, 하체, 유산소 등 |
| `exercise_type` | `strength`, `cardio`, `bodyweight`, `other` |
| `memo` | 운동별 메모 |
| `device_id` | 생성/수정 기기 |
| `created_at` | 생성 시각 |
| `updated_at` | 수정 시각 |
| `deleted_at` | soft delete |

### workout_sets

운동 종목 안의 세트 row다.

역할:

- 어떤 운동을 몇 세트 했는지 저장한다.
- 각 세트의 무게, 반복 수, 완료 여부를 저장한다.
- Android Fitness 앱의 핵심 입력 단위다.

주요 필드 후보:

| 필드 | 역할 |
| --- | --- |
| `id` | set row id |
| `user_id` | 사용자 스코프 |
| `exercise_id` | `workout_exercises.id` |
| `session_id` | 조회 최적화를 위한 denormalized session id |
| `set_index` | 세트 순서 |
| `target_reps` | 목표 반복 수 |
| `actual_reps` | 실제 반복 수 |
| `weight_kg` | 사용 중량 |
| `duration_seconds` | 유산소 또는 시간 기반 운동용 |
| `distance_meters` | 달리기/걷기 등 거리 기반 운동용 |
| `rest_seconds` | 세트 후 휴식 시간 |
| `is_completed` | 완료 여부 |
| `rpe` | 운동 강도, MVP 이후 가능 |
| `memo` | 세트 메모 |
| `device_id` | 생성/수정 기기 |
| `created_at` | 생성 시각 |
| `updated_at` | 수정 시각 |
| `deleted_at` | soft delete |

### body_metrics

체중과 신체 지표를 저장한다.

역할:

- 기존 `weight_records`보다 확장 가능한 체성분/신체 지표 테이블이다.
- MVP에서는 체중만 필수로 본다.

주요 필드 후보:

| 필드 | 역할 |
| --- | --- |
| `id` | metric row id |
| `user_id` | 사용자 스코프 |
| `date` | 측정 날짜 |
| `weight_kg` | 체중 |
| `body_fat_percent` | 체지방률, 선택 |
| `muscle_mass_kg` | 골격근량 또는 근육량, 선택 |
| `waist_cm` | 허리둘레, 선택 |
| `source` | `manual`, `quick_record`, `imported` |
| `created_from_quick_record_id` | quick_records 연결 |
| `device_id` | 생성/수정 기기 |
| `created_at` | 생성 시각 |
| `updated_at` | 수정 시각 |
| `deleted_at` | soft delete |

### meals

식단 텍스트 기록을 저장한다. 사진 첨부는 MVP 범위가 아니다.

역할:

- 하루 식단 또는 한 끼 식단을 텍스트로 기록한다.
- 칼로리와 단백질을 수동 입력한다.
- 기존 `meal_records`와 호환 가능한 요약 값을 제공한다.

주요 필드 후보:

| 필드 | 역할 |
| --- | --- |
| `id` | meal row id |
| `user_id` | 사용자 스코프 |
| `date` | 식사 날짜 |
| `meal_type` | `breakfast`, `lunch`, `dinner`, `snack`, `unknown` |
| `menu_text` | 식단 텍스트 |
| `calories` | 칼로리 |
| `protein_grams` | 단백질 |
| `carbs_grams` | 탄수화물, 선택 |
| `fat_grams` | 지방, 선택 |
| `source` | `manual`, `quick_record`, `imported` |
| `created_from_quick_record_id` | quick_records 연결 |
| `device_id` | 생성/수정 기기 |
| `created_at` | 생성 시각 |
| `updated_at` | 수정 시각 |
| `deleted_at` | soft delete |

## 5. Relationships

기본 관계:

```text
workout_sessions 1 -> N workout_exercises
workout_exercises 1 -> N workout_sets
quick_records 1 -> 0..1 workout_sessions
quick_records 1 -> 0..1 meals
quick_records 1 -> 0..1 body_metrics
```

권장 원칙:

- `workout_sets`는 `workout_exercises`에 종속된다.
- `workout_exercises`는 `workout_sessions`에 종속된다.
- 세션이 soft delete되면 하위 exercise/set도 조회에서 제외한다.
- DB cascade hard delete는 MVP에서 사용하지 않는다.
- 모든 주요 row는 `deleted_at`을 가진다.
- 모든 주요 row는 `user_id`, `device_id`, `created_at`, `updated_at`을 가진다.
- 빠른 기록에서 구조화된 row는 `created_from_quick_record_id`를 가진다.

## 6. Existing Table Compatibility

기존 테이블은 지금 OS가 실제로 사용하고 있으므로 유지한다.

기존 테이블 역할:

- `workout_records`: OS 기록 화면과 달력 마커용 단순 운동 요약
- `meal_records`: OS 기록 화면과 영양 요약용 단순 식단 기록
- `weight_records`: OS 기록 화면과 체중 변화 요약용 단순 체중 기록

새 Fitness 원본 테이블과의 관계:

- `workout_sessions`는 원본 상세 기록이다.
- `workout_records`는 당분간 legacy summary 또는 OS 호환 row로 취급한다.
- `meals`는 원본 식단 기록이다.
- `meal_records`는 당분간 legacy summary 또는 OS 호환 row로 취급한다.
- `body_metrics`는 원본 신체 지표 기록이다.
- `weight_records`는 당분간 legacy summary 또는 OS 호환 row로 취급한다.

전환 전략 후보:

| 전략 | 설명 | 판단 |
| --- | --- | --- |
| 기존 테이블 유지 | Fitness 앱은 새 테이블만 쓰고, OS는 기존 테이블을 계속 조회 | 가장 안전하지만 OS summary 연결이 늦어진다 |
| summary 동기화 | Fitness 원본 row 생성 시 기존 summary row도 생성 | OS 기존 화면 호환이 쉽지만 중복 데이터 관리가 필요하다 |
| view 기반 연결 | OS가 새 원본 테이블을 view로 요약해서 조회 | 장기적으로 좋지만 구현 전 DB view 설계가 필요하다 |

권장:

- Phase 2에서는 전환 전략을 문서로만 확정한다.
- Phase 3 Fitness MVP는 새 원본 테이블 기준으로 시작한다.
- Phase 4 OS summary 연결에서 view 기반 조회를 우선 검토한다.
- 기존 테이블 삭제나 즉시 migration은 하지 않는다.

## 7. Quick Records Integration

Phase 1의 `quick_records` 규칙을 따른다.

운동 빠른 기록:

```text
quick_records.raw_text = "벤치프레스 60kg 5세트"
quick_records.record_type = "workout"
quick_records.linked_entity_type = "workout_session"
quick_records.linked_entity_id = workout_sessions.id
workout_sessions.created_from_quick_record_id = quick_records.id
```

식단 빠른 기록:

```text
quick_records.raw_text = "점심 닭가슴살 샐러드 450kcal 단백질 35g"
quick_records.record_type = "meal"
quick_records.linked_entity_type = "meal"
quick_records.linked_entity_id = meals.id
meals.created_from_quick_record_id = quick_records.id
```

체중 빠른 기록:

```text
quick_records.raw_text = "오늘 체중 73.4kg"
quick_records.record_type = "body_metric"
quick_records.linked_entity_type = "body_metric"
quick_records.linked_entity_id = body_metrics.id
body_metrics.created_from_quick_record_id = quick_records.id
```

주의:

- 빠른 기록 원문은 삭제하지 않는다.
- 구조화가 잘못되면 연결을 해제하거나 새 도메인 row로 재연결한다.
- 도메인 앱에서 직접 입력한 기록은 `created_from_quick_record_id`가 null일 수 있다.
- OS timeline은 quick record가 없는 도메인 row도 표시할 수 있어야 한다.

## 8. OS Summary Scope

OS/MemoNote가 조회할 fitness 범위는 제한한다.

OS에서 조회할 것:

- 오늘 운동 여부
- 최근 운동 세션
- 주간 운동 횟수
- 주간 주요 운동 요약
- 최근 체중
- 체중 변화
- 최근 식단 입력 여부
- 평균 칼로리
- 평균 단백질

OS에서 직접 수정하지 않을 것:

- 세션 안의 운동 종목 순서
- 세트별 무게
- 세트별 반복 수
- 휴식 시간
- 운동 루틴 상세
- 식단 영양소 상세 보정

OS summary 후보:

- `fitness_summary_view`: 최근 운동, 주간 운동 횟수, 최근 체중, 최근 식단 여부
- `daily_fitness_view`: 특정 날짜의 운동 여부, 세션 수, 식단 수, 체중
- `weekly_fitness_review_view`: 주간 운동 빈도, 총 세트 수, 체중 변화, 평균 칼로리/단백질

이 문서 단계에서는 view SQL을 작성하지 않는다.

## 9. Android MVP Scope

Android Fitness MVP에서 필요한 것:

- 운동 세션 생성
- 운동 종목 추가
- 세트 추가
- 세트별 무게 입력
- 세트별 반복 수 입력
- 세트 완료 체크
- 세션 완료 처리
- 체중 입력
- 식단 텍스트 입력
- 칼로리와 단백질 수동 입력
- offline local-first 저장 설계 고려

MVP에서 제외할 것:

- 사진 식단 기록
- AI 식단 분석
- 루틴 자동 추천
- Apple Health / Google Fit 자동 연동
- 웨어러블 자동 연동
- 운동 자세 분석
- 복잡한 PR 계산
- 소셜 기능

iPhone 확장 고려:

- DB는 Android 전용 컬럼을 만들지 않는다.
- `source_app`, `device_id`, `platform` 같은 출처 정보로 구분한다.
- 모바일 앱이 바뀌어도 Supabase 원본 테이블은 유지한다.

## 10. Index and Query Needs

문서 기준의 조회 요구다. 실제 index SQL은 migration 단계에서 작성한다.

자주 필요한 조회:

- user별 최근 운동 세션
- user별 특정 날짜 운동 세션
- user별 특정 기간 운동 횟수
- session별 exercises
- exercise별 sets
- user별 최근 체중
- user별 기간별 체중 변화
- user별 날짜별 식단
- user별 기간별 평균 칼로리/단백질
- quick_record id로 생성된 도메인 row 조회

index 후보:

- `workout_sessions(user_id, date desc)`
- `workout_sessions(user_id, updated_at desc)`
- `workout_exercises(user_id, session_id, order_index)`
- `workout_sets(user_id, exercise_id, set_index)`
- `body_metrics(user_id, date desc)`
- `meals(user_id, date desc)`
- `*_created_from_quick_record_id_idx`

## 11. Open Decisions

구현 전 결정해야 할 질문:

- 기존 `workout_records`를 계속 직접 입력 가능한 테이블로 둘 것인가, 아니면 OS summary 전용 legacy row로 낮출 것인가?
- `meal_records`와 새 `meals`를 병행할 때 중복 표시를 어떻게 막을 것인가?
- `weight_records`와 새 `body_metrics` 중 OS가 어느 쪽을 우선 조회할 것인가?
- Fitness 앱 MVP도 local-first를 필수로 할 것인가?
- Android 앱의 로컬 저장소는 SQLite를 쓸 것인가?
- 세션 진행 중 상태를 Supabase에 즉시 sync할 것인가, 완료 시점에 sync할 것인가?
- 세트 단위 soft delete가 필요한가, 아니면 세션 단위 삭제만 허용할 것인가?
- cardio 기록은 `workout_sets`에 넣을 것인가, 별도 `cardio_metrics`로 분리할 것인가?
- 운동 종목 master table이 MVP에 필요한가, 아니면 자유 입력으로 시작할 것인가?
- quick record 하나가 workout session 하나만 만들 수 있게 제한할 것인가?

권장 초기 결정:

- 운동 종목 master table 없이 자유 입력으로 시작한다.
- quick record 하나는 workout session 하나와 연결한다.
- 세트 단위 soft delete를 허용한다.
- cardio도 MVP에서는 `workout_exercises` + `workout_sets`의 duration/distance 필드로 처리한다.
- 기존 `workout_records`, `meal_records`, `weight_records`는 Phase 4 전까지 유지한다.

## 12. Safe Implementation Order

1. 문서 확정

- 이 문서를 기준으로 테이블 책임과 기존 테이블 호환 전략을 확정한다.

2. Fitness MVP 화면 범위 확정

- Android 첫 화면에서 필요한 입력만 정한다.
- 운동 세션, 운동 종목, 세트, 체중, 식단 텍스트만 포함한다.

3. TypeScript 또는 앱 내부 모델 초안 작성

- DB migration 없이 앱 모델 수준에서 필드 이름을 먼저 검증한다.
- 날짜, 시간, 숫자 입력 규칙을 정한다.

4. Supabase migration 초안 작성

- 구현 단계에서만 진행한다.
- `workout_sessions`, `workout_exercises`, `workout_sets`, `body_metrics`, `meals`를 작게 만든다.
- 기존 테이블 변경은 최소화한다.

5. Android local-first 저장 설계

- SQLite 기반 로컬 저장을 우선 검토한다.
- offline 생성 후 online sync를 고려한다.

6. Fitness 앱 MVP 구현

- 세션 생성
- 운동 추가
- 세트 추가/완료
- 체중 입력
- 식단 텍스트 입력

7. OS summary 연결

- 기존 OS 화면은 유지한다.
- 새 원본 테이블을 summary view로 읽는 방식부터 검토한다.
- 중복 표시 방지 규칙을 만든다.

8. 기존 테이블 정리 여부 판단

- 충분히 검증되기 전까지 기존 테이블을 삭제하지 않는다.
- data migration은 별도 단계로 분리한다.

## Release Notes

아직 구현 변경은 없습니다. 이 문서는 Phase 2 Fitness DB 설계를 위한 기준 문서입니다.
