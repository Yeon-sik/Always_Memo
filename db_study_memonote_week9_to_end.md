# MemoNote로 배우는 데이터베이스 학습 노트

대상: 데이터베이스 지식이 낮은 초보자  
범위: 강의자료 9주차부터 16주차까지  
비교 대상 앱: Yeonsik's Note / MemoNote  
작성 목적: 강의 개념을 실제 메모 앱의 저장, 동기화, 삭제, 보안, 인덱스 구조와 연결해서 이해한다.

---

## 0. 먼저 결론부터 잡기

이 문서는 데이터베이스 강의 내용을 단순 암기용으로 다시 쓰는 문서가 아니다.  
강의에서 배운 개념이 실제 메모 프로그램에서 어디에 나타나는지 비교하면서 이해하기 위한 문서다.

현재 MemoNote의 데이터 구조를 한 문장으로 말하면 다음과 같다.

> 앱은 로컬에서는 `localStorage`에 전체 스냅샷을 저장하고, 원격 동기화가 설정되면 Supabase Postgres의 여러 테이블에 데이터를 저장한다.

중요한 구분이 있다.

| 구분 | 현재 MemoNote 상태 | DB 강의와의 관련 |
| --- | --- | --- |
| 로컬 저장 | browser `localStorage` | 관계형 DB는 아니다. JSON 파일처럼 저장하는 구조에 가깝다. |
| 원격 저장 | Supabase Postgres | 관계형 DB다. 테이블, 기본키, 외래키, 인덱스, SQL 개념이 직접 적용된다. |
| 동기화 | Supabase pull/push/Realtime | 트랜잭션, 동시성, 충돌 처리 개념과 연결된다. |
| 삭제 | hard delete가 아니라 `deleted_at` tombstone | `delete`와 `drop`, 무결성, 복구 감각과 연결된다. |
| 보안 | RLS 정책은 현재 주석 제안 상태 | 보안 강의 내용과 연결되지만, 완성 구현은 아니다. |

따라서 이 문서에서 "앱의 DB"라고 말할 때는 주로 Supabase Postgres 쪽을 의미한다.  
로컬 저장은 DB 사고방식을 일부 적용하지만, 현재 구현 기준으로는 SQL DB가 아니다.

---

## 1. 현재 앱의 데이터 기능 요약

강의 개념을 보기 전에, 앱이 실제로 어떤 데이터를 다루는지 먼저 봐야 한다.

현재 앱의 주요 데이터는 다음과 같다.

| 앱 기능 | TypeScript 엔티티 | Supabase 테이블 | 설명 |
| --- | --- | --- | --- |
| 메모 | `Note` | `notes` | 제목과 본문을 저장한다. |
| 체크리스트 | `Task` | `tasks` | 할 일, 완료 여부, 순서, 날짜/시간을 저장한다. |
| 운동 기록 | `WorkoutRecord` | `workout_records` | 운동 날짜, 운동 종류, 부위/분류, 운동명, 시간, 평균 심박수를 저장한다. |
| 식사 기록 | `MealRecord` | `meal_records` | 날짜, 메뉴, 칼로리, 단백질, 탄수화물, 지방을 저장한다. |
| 체중 기록 | `WeightRecord` | `weight_records` | 날짜와 체중을 저장한다. |
| 기기 상태 | `Device` | `devices` | 어느 기기에서 변경했는지, 마지막 접속 시각을 저장한다. |

공통으로 중요한 필드도 있다.

| 필드 | 의미 | 왜 필요한가 |
| --- | --- | --- |
| `id` | 각 row의 고유 식별자 | 같은 제목의 메모가 여러 개 있어도 구분해야 한다. |
| `created_at` / `createdAt` | 처음 생성된 시각 | 기록이 처음 만들어진 시점을 보존한다. |
| `updated_at` / `updatedAt` | 마지막 수정 시각 | 여러 기기에서 수정했을 때 무엇이 최신인지 판단한다. |
| `deleted_at` / `deletedAt` | 삭제된 시각, 삭제되지 않았으면 `null` | 다른 기기에도 삭제를 전파하기 위해 필요하다. |
| `device_id` / `deviceId` | 변경을 만든 기기 ID | 자기 기기에서 만든 변경을 Realtime으로 다시 받아 중복 반영하지 않기 위해 필요하다. |
| `user_id` | 사용자 구분값 | 원격 DB에서 사용자별 데이터를 분리하기 위해 필요하다. |

초보자가 여기서 잡아야 할 핵심은 이것이다.

> 앱의 버튼 하나가 눌릴 때마다 데이터는 그냥 화면에만 바뀌는 것이 아니라, 식별자, 수정시각, 삭제상태, 기기정보를 함께 가진 row로 관리된다.

---

## 2. 강의 9주차: NULL, 중첩 질의, VIEW

### 2.1 9주차 핵심

9주차 강의의 중심은 다음 세 가지다.

1. `NULL`
2. 중첩 질의
3. `VIEW`

MemoNote에서 가장 직접 연결되는 것은 `NULL`이다.  
중첩 질의와 `VIEW`는 현재 앱 코드에서 핵심 기능으로 쓰이지는 않지만, 앱이 커질 때 왜 필요한지 이해하기 좋다.

---

### 2.2 NULL이란 무엇인가

초보자가 자주 헷갈리는 부분부터 정리한다.

`NULL`은 0이 아니다.  
빈 문자열 `""`도 아니다.  
`false`도 아니다.

`NULL`은 "값이 없음", "아직 모름", "해당 없음"을 의미한다.

예를 들어 체크리스트에 마감 시간이 있을 수도 있고 없을 수도 있다.

```text
Task
- text: "DB 공부하기"
- dueDate: "2026-06-14"
- dueTime: null
```

이 경우 `dueTime`이 `null`이라는 뜻은 "마감 시간이 00:00이다"가 아니다.  
"마감 날짜는 있지만, 시간은 지정하지 않았다"는 뜻이다.

MemoNote에서 `NULL`과 직접 연결되는 필드는 많다.

| 필드 | 예시 | 의미 |
| --- | --- | --- |
| `deleted_at` | `null` | 아직 삭제되지 않았다. |
| `deleted_at` | `"2026-06-14T10:30:00Z"` | 이 시각에 삭제됐다. |
| `due_time` | `null` | 체크리스트에 특정 시간이 없다. |
| `duration_seconds` | `null` | 운동 시간이 입력되지 않았다. |
| `average_heart_rate` | `null` | 평균 심박수가 입력되지 않았다. |
| `carbs_grams` | `null` | 탄수화물이 입력되지 않았다. |
| `fat_grams` | `null` | 지방이 입력되지 않았다. |

여기서 가장 중요한 것은 `deleted_at`이다.

---

### 2.3 `deleted_at IS NULL`은 "보이는 데이터"의 기준이다

MemoNote는 삭제할 때 row를 실제로 없애지 않는다.

일반적인 초보자 사고는 다음과 같다.

```sql
delete from notes where id = '...';
```

하지만 MemoNote는 이런 방식이 아니라 다음에 가깝게 작동한다.

```sql
update notes
set deleted_at = now(),
    updated_at = now()
where id = '...';
```

왜 이렇게 할까?

메모 앱이 한 기기에서만 동작한다면 실제 삭제도 가능하다.  
하지만 MemoNote는 여러 기기 동기화를 고려한다.

예를 들어 다음 상황을 생각해 보자.

1. 노트북과 데스크톱에 같은 메모가 있다.
2. 노트북에서 메모를 삭제했다.
3. 데스크톱은 그 순간 꺼져 있었다.
4. 나중에 데스크톱이 켜졌다.

만약 노트북에서 row를 완전히 삭제했다면, 데스크톱은 "삭제 사실"을 알기 어렵다.  
데스크톱에는 아직 오래된 메모가 남아 있기 때문에, 동기화 과정에서 오히려 삭제된 메모를 다시 살려버릴 수 있다.

그래서 삭제 자체를 하나의 상태로 저장한다.

```text
삭제 전
id = A
title = "DB 공부"
deleted_at = null

삭제 후
id = A
title = "DB 공부"
deleted_at = "2026-06-14T10:30:00Z"
```

이제 다른 기기는 row가 없어진 것이 아니라 "삭제된 row"를 받는다.  
그래서 화면에는 숨기고, 동기화에서는 삭제 상태를 전파할 수 있다.

앱 화면에서 보이는 데이터는 결국 이런 조건을 만족해야 한다.

```sql
select *
from notes
where user_id = ?
  and deleted_at is null;
```

TypeScript 코드에서는 비슷한 사고가 다음처럼 나타난다.

```ts
notes.filter((note) => note.deletedAt === null)
```

즉, `NULL`은 단순한 빈값이 아니다.  
MemoNote에서는 "아직 살아 있는 row"와 "삭제된 row"를 구분하는 핵심 신호다.

---

### 2.4 `= NULL`이 아니라 `IS NULL`

SQL에서 초보자가 자주 하는 실수가 있다.

```sql
where deleted_at = null
```

이 방식은 올바른 NULL 비교가 아니다.  
SQL에서는 `NULL`이 "알 수 없음"이기 때문에 일반적인 `=` 비교로 판단하지 않는다.

올바른 표현은 다음이다.

```sql
where deleted_at is null
```

반대로 삭제된 row만 찾고 싶다면 다음처럼 쓴다.

```sql
where deleted_at is not null
```

MemoNote로 이해하면 쉽다.

| 원하는 데이터 | SQL 조건 |
| --- | --- |
| 화면에 보여줄 메모 | `deleted_at is null` |
| 휴지통에 보여줄 메모 | `deleted_at is not null` |
| 최근 수정된 메모 | `deleted_at is null order by updated_at desc` |

---

### 2.5 중첩 질의는 언제 필요할까

중첩 질의는 SQL 안에 SQL을 넣는 것이다.

```sql
select *
from notes
where device_id in (
  select id
  from devices
  where user_id = 'user-1'
);
```

현재 MemoNote의 동기화 코드는 Supabase 클라이언트에서 테이블별로 `.select("*").eq("user_id", context.userId)`처럼 읽는 방식이 중심이다.  
따라서 복잡한 중첩 질의가 앱의 핵심 구현으로 많이 드러나지는 않는다.

하지만 앱이 커지면 중첩 질의가 유용해진다.

예를 들어 다음 질문을 DB에 하고 싶다고 하자.

> 최근 7일 동안 실제로 활동한 기기에서 만든 메모만 가져와라.

이 경우 `devices`에서 최근 활동 기기를 먼저 찾고, 그 기기들이 만든 `notes`를 가져올 수 있다.

```sql
select *
from notes
where device_id in (
  select id
  from devices
  where last_seen_at >= now() - interval '7 days'
);
```

초보자 관점에서는 이렇게 이해하면 된다.

> 중첩 질의는 "먼저 조건에 맞는 목록을 구하고, 그 결과를 바탕으로 다시 조회"할 때 쓴다.

---

### 2.6 VIEW는 왜 필요할까

`VIEW`는 실제 테이블을 새로 복사하는 것이 아니라, 자주 쓰는 조회식을 이름 붙여 놓은 가상 테이블이다.

MemoNote에서 자주 필요한 조회는 "삭제되지 않은 내 메모"일 가능성이 높다.

매번 이렇게 쓰면 길다.

```sql
select *
from notes
where user_id = 'user-1'
  and deleted_at is null;
```

이를 View로 만들면 다음처럼 표현할 수 있다.

```sql
create view active_notes as
select *
from notes
where deleted_at is null;
```

그 다음에는 이렇게 쓸 수 있다.

```sql
select *
from active_notes
where user_id = 'user-1';
```

현재 MemoNote의 `schema.sql`에는 이런 View가 핵심 구현으로 들어가 있지는 않다.  
하지만 앱이 커지면 다음과 같은 View를 고려할 수 있다.

| View 이름 | 의미 |
| --- | --- |
| `active_notes` | 삭제되지 않은 메모 |
| `active_tasks` | 삭제되지 않은 체크리스트 |
| `daily_records` | 날짜별 메모, 운동, 식사, 체중 기록 통합 조회 |
| `recent_activity` | 최근 수정된 모든 활동 |

주의할 점도 있다.

View는 편리하지만, 초보 프로젝트에서 무조건 먼저 만들 필요는 없다.  
현재 MemoNote처럼 앱 코드에서 필터링과 동기화 흐름이 명확하다면, View는 나중에 조회가 복잡해졌을 때 추가해도 된다.

---

## 3. 강의 10주차: 무결성과 보안

### 3.1 무결성이란 무엇인가

무결성은 데이터가 말이 되는 상태를 유지하는 것이다.

예를 들어 다음 데이터는 이상하다.

```text
체중 기록
date = null
weight_kg = -300
```

날짜가 없고 체중이 음수다.  
앱 화면에서 입력을 막을 수도 있지만, DB에서도 이런 이상한 값이 들어오지 못하게 막을 수 있다.

강의에서는 무결성 제약을 배운다.

| 제약 | 의미 |
| --- | --- |
| 기본키 제약 | row를 고유하게 식별해야 한다. |
| 참조 무결성 | 외래키가 참조하는 대상이 실제로 있어야 한다. |
| NOT NULL | 반드시 값이 있어야 한다. |
| UNIQUE | 중복되면 안 된다. |
| CHECK | 특정 조건을 만족해야 한다. |
| DEFAULT | 값이 없으면 기본값을 넣는다. |

MemoNote의 Supabase 스키마에는 이 개념들이 실제로 들어가 있다.

---

### 3.2 기본키: 같은 메모를 어떻게 구분할까

메모 앱에서 제목만으로 메모를 구분하면 안 된다.

예를 들어 사용자는 같은 제목의 메모를 여러 개 만들 수 있다.

```text
title = "공부"
content = "DB 9주차 복습"

title = "공부"
content = "운동 루틴 정리"
```

제목이 같다고 같은 메모가 아니다.  
그래서 각 메모에는 `id`가 필요하다.

Supabase 스키마에서는 다음처럼 메모의 `id`가 기본키다.

```sql
create table if not exists public.notes (
  id uuid primary key,
  ...
);
```

기본키의 역할은 다음과 같다.

1. row를 하나만 정확히 찾는다.
2. 중복 row를 막는다.
3. 수정, 삭제, 동기화의 기준점이 된다.

예를 들어 메모 제목을 수정한다고 할 때, 앱은 제목으로 수정 대상을 찾으면 위험하다.

위험한 사고:

```sql
update notes
set title = '새 제목'
where title = '공부';
```

이러면 제목이 "공부"인 메모가 여러 개일 때 모두 바뀔 수 있다.

안전한 사고:

```sql
update notes
set title = '새 제목',
    updated_at = now()
where id = '정확한-메모-id';
```

초보자는 이것만 기억하면 된다.

> 제목, 내용, 날짜는 사용자가 바꿀 수 있다. 하지만 `id`는 row의 신분증이다.

---

### 3.3 복합 기본키: `devices` 테이블이 특이한 이유

대부분 테이블은 `id uuid primary key`를 쓴다.  
하지만 `devices` 테이블은 다르다.

```sql
create table if not exists public.devices (
  id text not null,
  user_id text not null,
  name text not null,
  last_seen_at timestamptz not null,
  app_version text,
  primary key (user_id, id)
);
```

여기서는 기본키가 `(user_id, id)` 두 필드의 조합이다.

왜 그럴까?

기기 ID는 사용자 안에서는 고유하면 된다.  
다른 사용자까지 포함해 전 세계적으로 무조건 고유하다고 가정하지 않는 설계다.

예를 들어:

| user_id | id | name |
| --- | --- | --- |
| user-A | laptop | A의 노트북 |
| user-B | laptop | B의 노트북 |

`id`만 보면 둘 다 `laptop`이다.  
하지만 `user_id + id`로 보면 서로 다르다.

강의에서 배운 복합키 개념이 바로 이런 상황에 쓰인다.

---

### 3.4 외래키: 이 기록은 어떤 기기에서 왔는가

MemoNote의 여러 테이블은 `device_id`를 가진다.

예를 들어 `notes`에는 다음 제약이 있다.

```sql
constraint notes_device_fk
  foreign key (user_id, device_id)
  references public.devices(user_id, id)
```

이 의미는 다음과 같다.

> notes의 `(user_id, device_id)` 값은 devices 테이블에 실제로 존재하는 `(user_id, id)` 조합이어야 한다.

즉, 어떤 메모가 "없는 기기에서 생성됐다"고 기록되는 것을 막는다.

초보자식으로 풀면 다음과 같다.

1. `devices`는 기기 목록이다.
2. `notes.device_id`는 "이 메모를 만든 기기"다.
3. 그런데 그 기기가 `devices`에 없으면 이상하다.
4. 그래서 DB가 외래키로 막는다.

이것이 참조 무결성이다.

참조 무결성은 실무에서 매우 중요하다.  
앱 코드에서 실수로 이상한 데이터를 보내더라도 DB가 마지막 방어선을 만들어 준다.

---

### 3.5 CHECK 제약: 운동 종류는 아무 문자열이나 안 된다

운동 기록에는 `workout_type`이 있다.

스키마에는 다음 조건이 있다.

```sql
workout_type text not null
  check (workout_type in ('strength', 'cardio', 'other'))
```

이 말은 `workout_type`에는 다음 세 값만 들어갈 수 있다는 뜻이다.

| 값 | 의미 |
| --- | --- |
| `strength` | 근력 운동 |
| `cardio` | 유산소 운동 |
| `other` | 기타 |

만약 앱 버그로 다음 값을 저장하려고 하면 DB가 막을 수 있다.

```text
workout_type = "sleep"
```

이 값은 허용 목록에 없다.

여기서 배울 점은 명확하다.

> 앱 UI에서 선택지를 제한해도, DB에서도 중요한 규칙은 한 번 더 막아야 한다.

초보 프로젝트에서는 모든 것을 DB 제약으로 복잡하게 만들 필요는 없다.  
하지만 타입이 정해진 핵심 필드에는 `CHECK`가 효과적이다.

---

### 3.6 NOT NULL: 반드시 있어야 하는 값

DB에서 `not null`은 "이 필드는 비워둘 수 없다"는 뜻이다.

예를 들어 `notes`의 `title`, `content`, `updated_at`, `device_id`는 비어 있으면 안 된다.

왜일까?

| 필드 | 비어 있으면 생기는 문제 |
| --- | --- |
| `title` | 목록에서 메모를 식별하기 어렵다. |
| `content` | 본문 없는 메모를 허용할지 정책이 모호해진다. |
| `updated_at` | 동기화 충돌 판단이 불가능하다. |
| `device_id` | 어느 기기에서 변경했는지 알 수 없다. |

특히 `updated_at`은 동기화에서 핵심이다.

MemoNote는 여러 기기에서 같은 row가 수정될 수 있다.  
이때 어느 버전이 더 최신인지 판단하려면 수정 시각이 반드시 있어야 한다.

```text
노트북 버전
updated_at = 2026-06-14 10:00

데스크톱 버전
updated_at = 2026-06-14 10:05
```

MVP 정책에서는 더 나중 시각인 데스크톱 버전이 이긴다.  
그런데 `updated_at`이 없다면 판단 기준이 사라진다.

---

### 3.7 DEFAULT: 앱이 값을 안 보내도 기본값을 넣는다

스키마에는 다음처럼 기본값이 있는 필드들이 있다.

```sql
created_at timestamptz not null default now()
is_backfilled boolean not null default false
```

`default now()`는 row가 생성될 때 값을 명시하지 않으면 현재 시각을 넣는다는 뜻이다.

초보자가 이해해야 할 포인트는 다음이다.

> DEFAULT는 앱 코드가 깜빡했을 때 DB가 합리적인 기본값을 채워 주는 장치다.

하지만 DEFAULT만 믿으면 안 된다.  
앱에서 생성 시각을 명확히 관리해야 하는 경우도 있다.

MemoNote는 local-first 앱이다.  
사용자가 오프라인에서 메모를 만들고 나중에 Supabase에 push할 수 있다.  
이때 DB의 `now()`만 쓰면 "실제로 메모를 만든 시각"이 아니라 "나중에 동기화된 시각"이 저장될 수 있다.

그래서 local-first 앱에서는 앱 쪽 `createdAt`과 DB 쪽 `created_at`의 의미를 조심해서 맞춰야 한다.

---

### 3.8 보안: 현재 앱의 중요한 미완성 지점

강의 10주차에는 보안과 권한도 나온다.

MemoNote에서 보안과 직접 관련되는 것은 Supabase Auth와 RLS다.

RLS는 Row Level Security의 약자다.  
간단히 말하면 "사용자가 자기 row만 볼 수 있게 DB가 직접 막는 기능"이다.

예를 들어 이상적인 정책은 다음과 같은 사고다.

```sql
using (user_id = auth.uid()::text)
with check (user_id = auth.uid()::text)
```

의미는 다음과 같다.

| 조건 | 의미 |
| --- | --- |
| `using` | 조회, 수정, 삭제할 수 있는 row 범위를 제한한다. |
| `with check` | 새로 넣거나 바꾸는 row도 자기 user_id여야 한다. |

현재 스키마에는 RLS 정책이 주석 제안 상태로 들어 있다.  
즉, 강의 개념과 연결은 되지만 "완성된 운영 보안"으로 보면 안 된다.

이 구분이 중요하다.

확인된 사실:

- `schema.sql`에 RLS 관련 SQL이 주석으로 제안되어 있다.
- README에서도 공개 배포 전에는 Supabase Auth와 RLS를 실제로 적용해야 한다고 적혀 있다.

강한 추론:

- 현재 개발 단계에서는 `USER_ID` 기반 분리로 동작하는 구조다.
- 개인 실습과 개발에는 충분할 수 있지만, 공개 운영 보안으로는 부족하다.

초보자에게 필요한 결론:

> 보안은 화면에서 버튼을 숨기는 것이 아니다. DB가 직접 "너는 이 row를 볼 수 없다"라고 막아야 진짜 보안에 가까워진다.

---

## 4. 강의 11주차: ERD에서 테이블 스키마로 변환

### 4.1 앱을 현실 세계로 먼저 해석하기

ERD를 배우는 이유는 현실의 정보를 테이블로 바꾸기 위해서다.

MemoNote의 현실 세계를 문장으로 쓰면 다음과 같다.

> 한 사용자는 여러 기기를 사용할 수 있고, 각 기기는 메모, 체크리스트, 운동 기록, 식사 기록, 체중 기록을 만들 수 있다.

이를 개체 중심으로 나누면 다음과 같다.

| 현실 개체 | 앱 데이터 | 테이블 |
| --- | --- | --- |
| 기기 | Device | `devices` |
| 메모 | Note | `notes` |
| 할 일 | Task | `tasks` |
| 운동 기록 | WorkoutRecord | `workout_records` |
| 식사 기록 | MealRecord | `meal_records` |
| 체중 기록 | WeightRecord | `weight_records` |

ERD를 그린다면 대략 이런 구조다.

```text
User
  1 ── N Devices

Devices
  1 ── N Notes
  1 ── N Tasks
  1 ── N WorkoutRecords
  1 ── N MealRecords
  1 ── N WeightRecords
```

현재 스키마에는 `users` 테이블이 별도로 없다.  
대신 각 테이블에 `user_id text not null`이 들어 있다.

이것은 개발 초기 구조로 볼 수 있다.  
Supabase Auth를 정식 도입하면 `auth.users`와 연결되는 구조로 정리할 수 있다.

---

### 4.2 강성 개체집합: 독립적으로 존재하는 테이블

강의에서 강성 개체집합은 자기 키를 가진 독립 개체다.

MemoNote에서는 다음 테이블들이 강성 개체에 가깝다.

| 테이블 | 자기 기본키 | 독립성 |
| --- | --- | --- |
| `notes` | `id` | 메모 하나를 독립 row로 다룬다. |
| `tasks` | `id` | 체크리스트 항목 하나를 독립 row로 다룬다. |
| `workout_records` | `id` | 운동 기록 하나를 독립 row로 다룬다. |
| `meal_records` | `id` | 식사 기록 하나를 독립 row로 다룬다. |
| `weight_records` | `id` | 체중 기록 하나를 독립 row로 다룬다. |

각 row는 자기 `id`가 있어서 개별 수정, 삭제, 동기화가 가능하다.

---

### 4.3 관계집합: 기기와 기록의 관계

`devices`와 `notes`의 관계를 보자.

한 기기는 여러 메모를 만들 수 있다.  
한 메모는 하나의 생성 기기 정보를 가진다.

관계는 다음과 같다.

```text
devices 1 : N notes
```

관계형 DB에서는 보통 N쪽 테이블에 외래키를 둔다.

그래서 `notes`에는 `device_id`가 있다.

```sql
device_id text not null,
foreign key (user_id, device_id)
  references public.devices(user_id, id)
```

강의 11주차의 "다대일 관계집합 변환"이 여기서 적용된다.

> one 쪽의 기본키를 many 쪽에 외래키로 추가한다.

MemoNote에 적용하면:

| one 쪽 | many 쪽 | many 쪽에 들어간 외래키 |
| --- | --- | --- |
| `devices` | `notes` | `(user_id, device_id)` |
| `devices` | `tasks` | `(user_id, device_id)` |
| `devices` | `workout_records` | `(user_id, device_id)` |
| `devices` | `meal_records` | `(user_id, device_id)` |
| `devices` | `weight_records` | `(user_id, device_id)` |

---

### 4.4 왜 메모와 태그는 아직 별도 테이블이 아닐까

강의 11주차에는 다대다 관계를 별도 테이블로 바꾸는 내용이 나온다.

예를 들어 메모에 태그 기능을 추가한다고 하자.

한 메모는 여러 태그를 가질 수 있다.  
한 태그는 여러 메모에 붙을 수 있다.

```text
notes N : M tags
```

관계형 DB에서는 다대다를 직접 표현하지 않고 중간 테이블을 만든다.

```sql
create table tags (
  id uuid primary key,
  user_id text not null,
  name text not null
);

create table note_tags (
  note_id uuid not null references notes(id),
  tag_id uuid not null references tags(id),
  primary key (note_id, tag_id)
);
```

하지만 현재 MemoNote에는 태그 기능이 핵심 구현으로 들어가 있지 않다.  
따라서 지금 이 구조를 미리 만들 필요는 없다.

이 판단이 중요하다.

> DB 설계는 미래 상상력을 전부 미리 구현하는 작업이 아니다. 현재 앱 기능에 필요한 관계부터 정확히 만드는 작업이다.

초보 프로젝트에서는 과설계를 조심해야 한다.  
태그, 폴더, 공유, 첨부파일, 버전 히스토리를 한 번에 넣으면 스키마가 커지고 동기화도 복잡해진다.

현재 앱 기준으로는 메모, 체크리스트, 기록, 기기 동기화가 먼저다.

---

### 4.5 다중값 속성: 왜 배열을 그냥 컬럼에 넣으면 위험한가

강의에서는 다중값 속성을 별도 테이블로 분리한다고 배운다.

예를 들어 한 운동 기록에 여러 운동 부위를 넣고 싶다고 하자.

나쁜 설계:

```text
workout_records
- id
- parts = "chest,shoulder,triceps"
```

이 방식은 간단해 보이지만 문제가 있다.

1. 특정 부위만 검색하기 어렵다.
2. 오타가 생겨도 DB가 막기 어렵다.
3. 통계 집계가 어려워진다.
4. 부위 이름 변경이 어렵다.

관계형 설계에서는 보통 다음처럼 나눈다.

```text
workout_records
- id
- date
- workout_type

workout_record_parts
- workout_record_id
- part
```

하지만 현재 MemoNote는 초보 MVP 성격이 강하다.  
운동 기록도 필요한 만큼 단순하게 관리한다.

따라서 "정규형만 보면 분리해야 할 수 있다"와 "현재 앱 범위에서는 단순 컬럼이 더 높은 ROI일 수 있다"를 구분해야 한다.

---

## 5. 강의 12주차: 함수적 종속과 정규화

### 5.1 정규화는 왜 배우는가

정규화는 중복과 모순을 줄이기 위한 설계 방법이다.

초보자는 정규화를 "테이블을 많이 쪼개는 기술"로 오해하기 쉽다.  
정확히는 그렇지 않다.

정규화의 목적은 다음이다.

1. 같은 정보를 여러 곳에 반복 저장하지 않는다.
2. 한 곳만 수정해서 일관성을 유지한다.
3. 삽입, 수정, 삭제 이상을 줄인다.

MemoNote 예제로 보자.

---

### 5.2 나쁜 설계 예: 기기 이름을 모든 메모에 반복 저장

다음처럼 `notes`에 기기 이름을 직접 저장한다고 가정해 보자.

```text
notes
- id
- title
- content
- device_id
- device_name
```

처음에는 편해 보인다.

```text
id = note-1
title = "DB 공부"
device_id = laptop-1
device_name = "내 노트북"

id = note-2
title = "운동 계획"
device_id = laptop-1
device_name = "내 노트북"
```

문제는 기기 이름을 바꿀 때 생긴다.

```text
"내 노트북" -> "집 노트북"
```

이제 모든 메모 row의 `device_name`을 수정해야 한다.  
하나라도 빠지면 같은 기기가 어떤 row에서는 "내 노트북", 어떤 row에서는 "집 노트북"으로 보인다.

이것이 수정 이상이다.

정규화된 설계는 다음과 같다.

```text
devices
- id
- user_id
- name

notes
- id
- user_id
- device_id
- title
- content
```

기기 이름은 `devices`에 한 번만 저장한다.  
`notes`는 `device_id`만 가진다.

기기 이름이 필요할 때는 조인해서 가져올 수 있다.

```sql
select n.title, d.name as device_name
from notes n
join devices d
  on n.user_id = d.user_id
 and n.device_id = d.id;
```

이것이 정규화의 감각이다.

---

### 5.3 함수적 종속을 MemoNote로 이해하기

함수적 종속은 말이 어렵지만 뜻은 단순하다.

> X 값을 알면 Y 값이 하나로 결정된다.

예를 들어 `devices`에서 `(user_id, id)`를 알면 `name`, `last_seen_at`, `app_version`이 결정된다.

```text
(user_id, id) -> name
(user_id, id) -> last_seen_at
(user_id, id) -> app_version
```

`notes`에서는 `id`를 알면 제목과 본문이 결정된다.

```text
id -> title
id -> content
id -> updated_at
id -> deleted_at
```

이때 `id`는 기본키이므로 자연스럽다.

문제가 되는 것은 기본키가 아닌 필드가 다른 필드를 결정하는 경우다.

예를 들어 만약 `notes`에 `device_name`을 넣는다면:

```text
device_id -> device_name
```

그런데 `notes`의 기본키는 `id`다.  
`device_name`은 메모 자체의 속성이라기보다 기기의 속성이다.

그래서 `device_name`은 `devices` 테이블로 빼는 것이 더 적절하다.

---

### 5.4 1NF: 한 칸에는 하나의 값

1차 정규형은 각 컬럼 값이 원자값이어야 한다는 개념이다.

나쁜 예:

```text
meal_records
- menu = "닭가슴살, 고구마, 샐러드"
```

이것이 항상 나쁜 것은 아니다.  
사용자가 자유롭게 식사 내용을 메모처럼 적는 기능이라면 문자열 하나로 충분하다.

하지만 음식별 영양 분석을 정확히 하고 싶다면 문제가 된다.

예를 들어 "고구마를 먹은 날만 찾아라" 같은 질의가 필요하면 문자열 검색에 의존해야 한다.

더 정규화된 구조는 다음과 같다.

```text
meals
- id
- date

meal_items
- id
- meal_id
- food_name
- calories
- protein_grams
```

현재 MemoNote는 식사 기록을 단순 기록으로 관리한다.  
따라서 `menu`를 문자열로 두는 것은 MVP 관점에서는 합리적이다.

하지만 앱이 식단 분석 도구로 확장된다면 `meal_items` 분리를 검토해야 한다.

---

### 5.5 2NF와 3NF를 앱 기준으로 이해하기

2NF와 3NF는 초보자에게 어렵다.  
MemoNote에서는 다음 기준으로 이해하면 된다.

2NF 질문:

> 복합키의 일부만으로 결정되는 필드가 있는가?

3NF 질문:

> 기본키가 아닌 필드가 다른 일반 필드를 결정하고 있지는 않은가?

현재 대부분 테이블은 `id` 단일 기본키를 쓴다.  
단일 기본키 테이블에서는 2NF 문제는 상대적으로 적다.

하지만 `devices`는 복합키 `(user_id, id)`를 사용한다.

```text
devices(user_id, id, name, last_seen_at, app_version)
```

여기서 `name`은 `id`만으로 결정되는 것처럼 보일 수도 있다.  
하지만 사용자별로 기기 ID가 겹칠 수 있다고 보면 `(user_id, id)` 전체가 필요하다.

3NF 관점에서 보면, 기기 이름을 `notes`에 반복 저장하지 않고 `devices`에 둔 점은 좋은 방향이다.

---

### 5.6 정규화와 MVP의 균형

정규화는 중요하지만, 초보 프로젝트에서 무조건 테이블을 많이 쪼개면 손해가 날 수 있다.

현재 MemoNote에서 분리를 미룰 수 있는 것들:

| 기능 | 지금은 단순 구조가 나은 이유 | 나중에 분리할 기준 |
| --- | --- | --- |
| 식사 메뉴 | 자유 텍스트 기록이면 충분하다. | 음식별 검색/영양 통계가 필요할 때 |
| 운동 카테고리 | 선택지가 제한적이면 문자열로 충분하다. | 부위별 통계와 사용자 정의 운동 사전이 필요할 때 |
| 메모 태그 | 핵심 기능이 아직 아니다. | 태그 검색/필터/공유가 핵심이 될 때 |
| 기록 히스토리 | 현재는 최신 상태 중심이다. | 변경 이력 복구가 필요할 때 |

좋은 기준은 이것이다.

> 같은 정보가 두 번 이상 반복되고, 하나를 바꿀 때 여러 row가 같이 바뀌어야 한다면 분리를 검토한다.

---

## 6. 강의 13주차: 물리적 저장 구조와 인덱스

### 6.1 인덱스란 무엇인가

인덱스는 책의 색인과 비슷하다.

책에서 "트랜잭션"이라는 단어를 찾기 위해 처음부터 끝까지 모든 페이지를 읽는 것은 비효율적이다.  
색인을 보면 해당 단어가 나온 페이지를 바로 찾을 수 있다.

DB에서도 마찬가지다.

인덱스가 없으면 DB는 많은 row를 처음부터 끝까지 훑어야 할 수 있다.  
인덱스가 있으면 조건에 맞는 row를 더 빨리 찾을 수 있다.

---

### 6.2 MemoNote에서 자주 쓰는 조회 조건

MemoNote가 자주 할 가능성이 높은 조회는 다음과 같다.

| 상황 | 자주 쓰는 조건 |
| --- | --- |
| 내 메모 불러오기 | `user_id = ?` |
| 최근 수정순 정렬 | `updated_at desc` |
| 삭제되지 않은 row만 보기 | `deleted_at is null` |
| 특정 날짜 기록 보기 | `date = ?` |
| 체크리스트 날짜별 보기 | `due_date = ?` |
| 활성 기기 보기 | `last_seen_at desc` |

그래서 스키마에는 다음과 같은 인덱스가 있다.

```sql
create index if not exists notes_user_updated_at_idx
  on public.notes(user_id, updated_at desc);

create index if not exists notes_user_deleted_at_idx
  on public.notes(user_id, deleted_at);

create index if not exists tasks_user_due_date_idx
  on public.tasks(user_id, due_date);

create index if not exists weight_records_user_date_idx
  on public.weight_records(user_id, date);
```

초보자 관점에서 보면 인덱스 이름이 길어도 겁먹을 필요 없다.  
보통 이름은 다음 정보를 담는다.

```text
테이블명 + 주요 컬럼명 + idx
```

예:

```text
notes_user_updated_at_idx
= notes 테이블에서 user_id와 updated_at 조회를 빠르게 하기 위한 인덱스
```

---

### 6.3 왜 `user_id`가 인덱스 앞에 자주 나오는가

MemoNote의 원격 DB는 여러 사용자를 고려한다.

대부분의 조회는 "전체 사용자 데이터"가 아니라 "현재 사용자 데이터"만 필요하다.

```sql
select *
from notes
where user_id = 'user-1'
order by updated_at desc;
```

이런 조회가 많다면 인덱스도 `user_id`를 앞에 두는 것이 자연스럽다.

```sql
on public.notes(user_id, updated_at desc)
```

이 인덱스는 다음 질문에 도움이 된다.

> user-1의 메모를 최신순으로 빠르게 가져와라.

만약 `updated_at`만 인덱스가 있고 `user_id`가 없다면, DB는 여러 사용자 데이터를 섞어 최신순으로 보다가 다시 user-1만 골라야 할 수 있다.

초보자에게 필요한 감각:

> 인덱스는 자주 쓰는 WHERE 조건과 ORDER BY 순서를 보고 만든다.

---

### 6.4 인덱스는 많을수록 좋은가

아니다.

강의에서도 인덱스의 장단점을 배운다.

| 장점 | 단점 |
| --- | --- |
| 검색이 빨라진다. | 삽입, 수정, 삭제 때 인덱스도 같이 갱신해야 한다. |
| 정렬과 조건 검색에 유리하다. | 저장 공간을 더 쓴다. |
| 큰 테이블에서 효과가 크다. | 작은 테이블에서는 효과가 작을 수 있다. |

MemoNote는 개인용 앱이고 Supabase 무료 한도를 고려한다.  
따라서 무작정 인덱스를 많이 만드는 것은 좋은 방향이 아니다.

현재처럼 다음 기준의 인덱스가 우선이다.

1. 사용자별 조회: `user_id`
2. 최신순 동기화: `updated_at`
3. 삭제 필터: `deleted_at`
4. 날짜별 기록: `date`, `due_date`
5. 기기 상태: `last_seen_at`

---

### 6.5 물리적 저장 구조는 앱 개발자가 얼마나 알아야 할까

강의 13주차에는 데이터 블록, 파일, 클러스터 인덱스, B+ 트리 같은 내용도 나온다.

MemoNote를 만드는 초보 개발자가 이 내용을 모두 직접 구현할 필요는 없다.  
Postgres와 Supabase가 내부 저장 구조를 담당한다.

하지만 최소한 이 정도 감각은 필요하다.

1. DB는 데이터를 그냥 마법처럼 찾는 것이 아니다.
2. 조건에 맞는 row를 찾으려면 저장 구조를 탐색해야 한다.
3. 인덱스가 있으면 탐색 범위를 줄일 수 있다.
4. 인덱스도 유지 비용이 있다.

즉, 물리 저장 구조를 완전히 구현할 필요는 없지만, 쿼리와 인덱스가 성능에 영향을 준다는 사실은 알아야 한다.

---

## 7. 강의 14주차: 트랜잭션, ACID, 동시성 제어

### 7.1 트랜잭션이란 무엇인가

트랜잭션은 하나의 논리적 작업 단위다.

예를 들어 은행 송금을 생각하면:

1. A 계좌에서 10,000원을 뺀다.
2. B 계좌에 10,000원을 더한다.

둘 중 하나만 성공하면 안 된다.  
둘 다 성공하거나, 둘 다 실패해야 한다.

메모 앱은 은행처럼 복잡하지 않지만, 트랜잭션 감각은 여전히 필요하다.

예를 들어 메모 수정은 단순히 `content`만 바꾸는 것이 아니다.

```text
content 변경
updated_at 변경
device_id 변경
localStorage 저장
가능하면 Supabase push
```

이 작업들이 논리적으로 하나의 변경을 구성한다.

---

### 7.2 ACID를 MemoNote로 이해하기

ACID는 트랜잭션의 네 가지 성질이다.

| 성질 | 의미 | MemoNote 예시 |
| --- | --- | --- |
| Atomicity | 모두 성공하거나 모두 실패 | 메모 제목만 바뀌고 `updated_at`이 안 바뀌면 안 된다. |
| Consistency | 전후 상태가 규칙을 만족 | `workout_type`이 허용값 중 하나여야 한다. |
| Isolation | 동시에 실행되어도 서로 방해하지 않음 | 두 기기가 같은 메모를 수정할 때 충돌이 관리되어야 한다. |
| Durability | 성공한 변경은 유지 | 앱을 껐다 켜도 메모가 남아야 한다. |

MemoNote에서 로컬 `localStorage`는 전통적인 DB 트랜잭션을 제공하는 구조는 아니다.  
반면 Supabase Postgres는 DBMS 차원에서 트랜잭션과 영속성을 제공한다.

앱 레벨에서는 다음 방식으로 최소한의 일관성을 관리한다.

1. 모든 수정에 `updatedAt`을 갱신한다.
2. 삭제는 `deletedAt` tombstone으로 남긴다.
3. 여러 버전이 들어오면 `updatedAt` 기준 Last Write Wins로 병합한다.
4. 같은 시각이면 tombstone을 우선해서 삭제 row가 되살아나지 않게 한다.

---

### 7.3 동시성 문제: 두 기기가 동시에 같은 메모를 수정하면?

동시성 문제를 MemoNote로 생각해 보자.

상황:

1. 노트북과 데스크톱에 같은 메모가 있다.
2. 노트북에서 제목을 "DB 공부"로 바꾼다.
3. 거의 동시에 데스크톱에서 제목을 "SQL 복습"으로 바꾼다.
4. 둘 다 Supabase에 push한다.

이때 어떤 값이 최종 제목이 되어야 할까?

현재 앱의 MVP 정책은 Last Write Wins다.

```text
노트북 변경
updatedAt = 10:00:01
title = "DB 공부"

데스크톱 변경
updatedAt = 10:00:05
title = "SQL 복습"
```

결과:

```text
title = "SQL 복습"
```

왜냐하면 더 나중에 수정된 row가 최신이라고 판단하기 때문이다.

이 방식은 단순하고 구현 비용이 낮다.  
하지만 단점도 있다.

| 장점 | 단점 |
| --- | --- |
| 구현이 쉽다. | 먼저 쓴 내용이 조용히 덮일 수 있다. |
| 초보 MVP에 적합하다. | 공동 편집에는 약하다. |
| 동기화 로직이 단순하다. | 사용자가 충돌을 직접 비교할 수 없다. |

따라서 MemoNote의 현재 정책은 "개인용 local-first 앱"에는 현실적인 선택이다.  
하지만 팀 협업 문서 편집기라면 CRDT나 변경 로그 기반 병합이 필요할 수 있다.

---

### 7.4 Lost Update를 MemoNote로 이해하기

강의의 lost update는 한 트랜잭션의 변경이 다른 트랜잭션에 의해 사라지는 문제다.

MemoNote 예시:

```text
원래 메모 내용:
"기말 DB 공부"
```

노트북:

```text
"기말 DB 공부 + 인덱스 정리"
updatedAt = 10:00
```

데스크톱:

```text
"기말 DB 공부 + 트랜잭션 정리"
updatedAt = 10:01
```

Last Write Wins 결과:

```text
"기말 DB 공부 + 트랜잭션 정리"
```

노트북에서 추가한 "인덱스 정리"는 사라진다.  
이것이 앱 레벨에서 볼 수 있는 lost update다.

현재 앱은 이 문제를 완전히 해결하지 않는다.  
대신 개인용 MVP라는 범위에서 최신 수정이 이기는 단순 정책을 선택한다.

초보자에게 중요한 것은 다음이다.

> 동시성 문제는 "DBMS가 알아서 다 해준다"로 끝나지 않는다. 앱의 충돌 정책도 필요하다.

---

### 7.5 삭제와 동시성: tombstone이 필요한 이유

삭제 충돌은 특히 위험하다.

상황:

1. 노트북에서 메모 A를 삭제한다.
2. 데스크톱은 오프라인이라 아직 메모 A를 가지고 있다.
3. 데스크톱이 나중에 온라인이 되면서 메모 A를 push한다.

만약 삭제를 hard delete로 처리했다면:

```text
Supabase에는 메모 A가 없음
데스크톱에는 메모 A가 있음
데스크톱 push로 메모 A가 다시 생김
```

이렇게 삭제한 메모가 되살아날 수 있다.

하지만 tombstone을 쓰면:

```text
Supabase에는 메모 A가 있음
deleted_at = 10:00

데스크톱에는 메모 A가 있음
deleted_at = null
updated_at = 09:50
```

병합 시 `updated_at`이 더 최신인 삭제 row가 이긴다.  
그래서 메모가 되살아나지 않는다.

이 구조는 강의의 동시성 제어와 복구 감각을 앱 레벨에서 단순화한 것이다.

---

## 8. 강의 15주차: 장애, 로그, 복구

### 8.1 복구는 왜 필요한가

복구는 장애가 났을 때 데이터베이스를 일관된 상태로 되돌리는 것이다.

MemoNote에서 생각할 수 있는 장애는 다음과 같다.

| 장애 | 예시 |
| --- | --- |
| 앱 종료 | 저장 도중 앱이 꺼진다. |
| 네트워크 장애 | Supabase push 중 인터넷이 끊긴다. |
| 기기 장애 | 한 기기가 오래 꺼져 있다가 다시 켜진다. |
| 동기화 실패 | 원격 DB는 바뀌었는데 로컬 반영이 실패한다. |
| 스키마 불일치 | 앱 코드와 Supabase 컬럼 구조가 다르다. |

전통적인 DB 강의에서는 로그, WAL, UNDO, REDO를 배운다.  
MemoNote 앱 코드가 DBMS 내부 로그를 직접 구현하지는 않는다.  
Supabase Postgres가 DBMS 내부 복구를 담당한다.

하지만 앱 레벨에서도 복구 감각이 필요하다.

---

### 8.2 local-first 구조는 일종의 장애 대응이다

MemoNote는 Supabase가 없어도 로컬에서 동작해야 한다.

흐름은 다음과 같다.

1. 앱 시작 시 `localStorage`에서 데이터를 읽는다.
2. Supabase 설정이 있으면 원격 데이터를 pull한다.
3. 로컬 스냅샷과 원격 스냅샷을 병합한다.
4. 사용자가 수정하면 먼저 로컬 상태와 localStorage에 저장한다.
5. 가능하면 Supabase에 push한다.

이 구조의 장점은 명확하다.

> 인터넷이 끊겨도 사용자는 기록을 계속할 수 있다.

DB 강의의 복구와 완전히 같은 개념은 아니지만, 목적은 비슷하다.

1. 장애가 생겨도 데이터를 잃지 않는다.
2. 나중에 가능한 시점에 일관성을 회복한다.
3. 변경 이력을 판단할 기준을 둔다.

여기서 기준이 되는 필드가 `updatedAt`과 `deletedAt`이다.

---

### 8.3 UNDO/REDO를 앱 관점으로 이해하기

강의에서:

| 개념 | 의미 |
| --- | --- |
| UNDO | 잘못 적용된 변경을 되돌린다. |
| REDO | 완료된 변경을 다시 적용한다. |

MemoNote의 현재 앱이 DBMS식 UNDO/REDO 로그를 직접 갖고 있지는 않다.  
하지만 비슷한 감각은 있다.

예를 들어 원격에서 다음 row를 받았다.

```text
id = note-1
updatedAt = 10:05
deletedAt = null
title = "SQL 복습"
```

로컬에는 다음 row가 있다.

```text
id = note-1
updatedAt = 10:00
deletedAt = null
title = "DB 공부"
```

앱은 원격 row가 최신이므로 로컬 row를 갱신한다.

이것은 REDO와 같지는 않지만, "완료된 최신 변경을 다시 적용한다"는 감각과 닮아 있다.

반대로 앱에 "삭제 취소" 기능을 만든다면:

```text
deletedAt = null
updatedAt = now()
```

이것은 앱 레벨의 UNDO에 가깝다.

정확히 말하면 DBMS 로그 기반 UNDO는 아니지만, 사용자 경험에서는 삭제 상태를 되돌리는 복구 동작이다.

---

### 8.4 변경 로그 기반 sync queue가 있으면 무엇이 달라질까

README에는 중간 단계 확장으로 "변경 로그 기반 sync queue"가 언급되어 있다.

현재 구조는 대략 "최신 스냅샷을 저장하고 병합"하는 방식이다.  
변경 로그 기반이 되면 다음처럼 각 작업을 기록할 수 있다.

```text
change_log
- id
- entity_type: "note"
- entity_id: "note-1"
- operation: "update"
- payload: {...}
- created_at
- synced_at
```

이렇게 하면 장점이 있다.

1. 어떤 변경이 아직 Supabase에 올라가지 않았는지 알 수 있다.
2. 실패한 변경만 재시도할 수 있다.
3. 충돌이 생겼을 때 원인을 추적하기 쉽다.
4. 복구와 디버깅이 쉬워진다.

하지만 단점도 있다.

1. 구현 난도가 올라간다.
2. 저장 공간이 늘어난다.
3. 동기화 순서와 중복 처리 규칙이 필요하다.
4. 초보 MVP에는 과할 수 있다.

현재 MemoNote는 단순성을 선택한 상태다.  
앱이 더 중요해지고 데이터 손실 허용도가 낮아지면 변경 로그 기반으로 확장하는 것이 다음 단계다.

---

## 9. 강의 16주차: 트랜잭션 격리 수준

### 9.1 격리 수준이란 무엇인가

격리 수준은 동시에 여러 트랜잭션이 실행될 때 서로의 중간 상태를 얼마나 볼 수 있는지 정하는 규칙이다.

강의에서는 다음을 배운다.

| 격리 수준 | 대략적 의미 |
| --- | --- |
| Read Uncommitted | 커밋되지 않은 변경도 읽을 수 있다. |
| Read Committed | 커밋된 변경만 읽는다. |
| Repeatable Read | 같은 트랜잭션 안에서는 같은 조회 결과를 유지한다. |
| Serializable | 거의 순차 실행처럼 가장 강하게 격리한다. |

MemoNote 개발자가 DB 내부 격리 수준을 직접 자주 설정하지는 않는다.  
Supabase/Postgres가 기본 동작을 제공한다.

하지만 앱 레벨에서는 비슷한 문제가 생긴다.

---

### 9.2 앱 레벨의 격리 문제

사용자가 앱을 보고 있는 동안 다른 기기에서 변경이 들어올 수 있다.

예를 들어:

1. 데스크톱에서 오늘 기록 화면을 보고 있다.
2. 노트북에서 새 운동 기록을 추가한다.
3. Supabase Realtime으로 데스크톱에 변경이 들어온다.
4. 데스크톱 화면의 오늘 기록이 자동 갱신된다.

이때 사용자는 같은 화면을 보고 있었는데 갑자기 데이터가 바뀐다.

DB 강의의 Non-Repeatable Read와 완전히 같지는 않지만, 사용자 경험 관점에서는 "방금 본 데이터가 다시 보니 달라졌다"는 문제가 된다.

그래서 앱은 다음을 신중히 설계해야 한다.

| 상황 | 설계 선택 |
| --- | --- |
| 목록 화면 | Realtime 변경을 즉시 반영해도 괜찮다. |
| 사용자가 편집 중인 폼 | 갑자기 덮어쓰면 위험하다. |
| 삭제 직후 undo UI | tombstone과 복원 정책이 명확해야 한다. |
| 통계 화면 | 실시간 갱신이 사용자에게 혼란을 주지 않아야 한다. |

초보자에게 중요한 점:

> 격리 수준은 DB 내부 개념이지만, 앱 화면에서도 "언제 최신 데이터를 반영할 것인가"라는 문제로 나타난다.

---

### 9.3 현재 MemoNote의 현실적 선택

현재 MemoNote는 개인용 local-first 앱이다.  
따라서 은행 시스템처럼 강한 격리 수준을 앱 레벨에서 직접 구현하지 않는다.

대신 다음 정책을 사용한다.

1. Realtime으로 다른 기기 변경을 받는다.
2. 현재 기기에서 만든 변경은 다시 반영하지 않는다.
3. 받은 row는 현재 스냅샷과 병합한다.
4. `updatedAt`이 최신인 row를 선택한다.
5. 같은 시각이면 tombstone을 우선한다.

이 방식은 단순하지만 합리적이다.

왜냐하면 MemoNote의 우선순위는 다음이기 때문이다.

1. 오프라인에서도 기록 가능
2. 여러 기기 사이에서 큰 충돌 없이 동기화
3. 무료 Supabase 범위에서 운영
4. 초보 프로젝트에서 유지 가능한 구조

---

## 10. 강의 개념과 앱 기능 매핑표

| 강의 주차 | 강의 개념 | MemoNote 대응 | 현재 구현 상태 |
| --- | --- | --- | --- |
| 9주차 | NULL | `deleted_at`, `due_time`, 선택 입력 필드 | 구현됨 |
| 9주차 | 중첩 질의 | 기기 기준 기록 조회, 최근 활동 기기 조회 등에 활용 가능 | 핵심 구현은 아님 |
| 9주차 | VIEW | `active_notes`, `daily_records` 같은 가상 조회로 확장 가능 | 미구현 |
| 10주차 | 기본키 | 대부분 테이블의 `id uuid primary key` | 구현됨 |
| 10주차 | 복합키 | `devices`의 `(user_id, id)` | 구현됨 |
| 10주차 | 외래키 | 기록 테이블의 `(user_id, device_id)`가 `devices` 참조 | 구현됨 |
| 10주차 | CHECK | `workout_type in (...)` | 구현됨 |
| 10주차 | 보안/RLS | 사용자별 row 접근 제한 | 주석 제안 상태 |
| 11주차 | ERD 변환 | 메모, 할 일, 운동, 식사, 체중, 기기를 테이블로 분리 | 구현됨 |
| 11주차 | 다대일 관계 | 기기 1개가 여러 기록을 생성 | 구현됨 |
| 11주차 | 다대다 관계 | 태그, 공유 기능에 필요할 수 있음 | 미구현 |
| 12주차 | 정규화 | 기기 정보는 `devices`로 분리 | 일부 적용 |
| 12주차 | 함수적 종속 | `id -> title/content`, `(user_id,id) -> device name` | 적용됨 |
| 13주차 | 인덱스 | `user_id`, `updated_at`, `deleted_at`, `date` 기준 인덱스 | 구현됨 |
| 14주차 | 트랜잭션 | 수정 시 내용과 `updatedAt`을 함께 갱신 | 앱 레벨로 관리 |
| 14주차 | 동시성 | Last Write Wins, tombstone 우선 | 구현됨 |
| 15주차 | 복구 | local-first, pull/push 병합, 삭제 전파 | 일부 구현 |
| 16주차 | 격리 수준 | Realtime 반영 시점과 편집 중 충돌 문제 | 단순 정책 |

---

## 11. 초보자를 위한 실습 질문

다음 질문에 직접 답해 보면 강의 개념과 앱 구조가 연결된다.

### 11.1 NULL 실습

질문:

> MemoNote에서 삭제되지 않은 메모만 가져오려면 어떤 조건이 필요할까?

답:

```sql
where deleted_at is null
```

추가 질문:

> `deleted_at = null`이라고 쓰면 왜 안 될까?

답:

`NULL`은 일반 값이 아니라 "값이 없음/알 수 없음"이므로 SQL에서는 `IS NULL`로 비교해야 한다.

---

### 11.2 무결성 실습

질문:

> `notes.device_id`가 `devices`에 없는 값을 가리키면 어떤 문제가 생길까?

답:

어떤 기기에서 만든 메모인지 추적할 수 없고, 동기화 충돌이나 Realtime 필터링에서 이상한 상태가 된다.  
그래서 외래키로 막는다.

---

### 11.3 정규화 실습

질문:

> 왜 `notes` 테이블에 `device_name`을 직접 저장하지 않고 `devices` 테이블을 따로 둘까?

답:

기기 이름이 바뀔 때 모든 메모 row를 수정해야 하는 중복 문제가 생기기 때문이다.  
기기 이름은 기기의 속성이므로 `devices`에 한 번만 저장하고, `notes`는 `device_id`로 참조하는 것이 낫다.

---

### 11.4 인덱스 실습

질문:

> `tasks_user_due_date_idx`는 어떤 조회를 빠르게 하기 위한 인덱스일까?

답:

특정 사용자의 특정 날짜 할 일을 가져오는 조회다.

```sql
select *
from tasks
where user_id = ?
  and due_date = ?;
```

---

### 11.5 동시성 실습

질문:

> 두 기기가 같은 메모를 동시에 수정하면 현재 앱은 어떤 버전을 선택할까?

답:

`updatedAt`이 더 최신인 row를 선택한다.  
이 정책을 Last Write Wins라고 볼 수 있다.

추가 질문:

> 이 방식의 약점은 무엇일까?

답:

먼저 수정한 내용이 나중 수정에 의해 조용히 덮일 수 있다.  
개인용 MVP에는 단순하고 적합하지만 공동 편집 도구에는 부족하다.

---

## 12. 이 앱을 DB 공부 예제로 볼 때의 정확한 한계

MemoNote는 좋은 실습 예제지만, 강의 전체를 모두 담고 있지는 않다.

포함되는 것:

1. 테이블 설계
2. 기본키
3. 외래키
4. `NULL`
5. `CHECK`
6. `DEFAULT`
7. soft delete
8. 인덱스
9. 사용자별 데이터 분리
10. Realtime 동기화
11. 충돌 병합
12. local-first 사고

직접 포함되지 않거나 약한 것:

1. 복잡한 JOIN 중심 화면
2. View 기반 조회
3. SQL 트랜잭션 직접 제어
4. DBMS 내부 로그, WAL, UNDO, REDO 구현
5. Oracle 테이블스페이스, 세그먼트, 데이터파일
6. 완성된 Supabase Auth/RLS 운영 보안
7. CRDT 같은 고급 동시 편집 알고리즘

이 한계를 알아야 한다.

> 이 앱은 DBMS 내부를 구현하는 예제가 아니라, 개인용 앱에서 관계형 DB 개념이 어떻게 적용되는지 보는 예제다.

---

## 13. 공부 순서 제안

초보자는 다음 순서로 보면 된다.

1. `notes` 테이블을 본다.
2. `id`, `title`, `content`, `updated_at`, `deleted_at`, `device_id`의 의미를 설명해 본다.
3. 삭제가 왜 `delete from notes`가 아니라 `deleted_at` 갱신인지 이해한다.
4. `devices` 테이블과 외래키 관계를 본다.
5. `tasks`, `workout_records`, `meal_records`, `weight_records`가 같은 패턴을 반복하는지 확인한다.
6. 인덱스가 어떤 조회를 빠르게 하려는지 추측해 본다.
7. Supabase sync 코드에서 `.select("*")`, `.upsert(...)`, Realtime 구독을 찾아본다.
8. 두 기기 충돌 시 `updatedAt`이 왜 필요한지 설명해 본다.
9. RLS가 왜 아직 완성 보안이 아닌지 확인한다.
10. 마지막으로 강의자료 9주차부터 16주차 개념표와 다시 연결한다.

---

## 14. 최종 요약

강의 9주차 이후 내용은 MemoNote와 꽤 많이 연결된다.

가장 직접적인 연결은 다음이다.

```text
NULL
-> deleted_at, due_time, 선택 입력 필드

무결성
-> primary key, foreign key, check, not null

ERD 변환
-> 메모/할 일/운동/식사/체중/기기를 테이블로 분리

정규화
-> 기기 정보를 devices로 분리하고 기록 테이블은 device_id만 참조

인덱스
-> user_id, updated_at, deleted_at, date 기준 조회 최적화

트랜잭션/동시성
-> updatedAt 기준 Last Write Wins, tombstone 우선

복구
-> local-first 저장, pull/push 병합, 삭제 전파

격리 수준
-> Realtime 변경 반영 시점과 편집 중 충돌 정책
```

하지만 다음은 현재 앱에 직접 구현된 것으로 말하면 안 된다.

```text
Oracle 테이블스페이스
DBMS 내부 WAL/UNDO/REDO 구현
복잡한 SQL View 중심 설계
완성된 RLS 운영 보안
CRDT 수준의 동시 편집
로컬 SQLite/IndexedDB 구현
```

현재 앱의 정확한 상태는 다음 한 문장이 가장 안전하다.

> MemoNote는 로컬에서는 `localStorage`를 사용하고, 원격 동기화에는 Supabase Postgres를 사용하는 local-first 메모/기록 앱이며, 강의 9주차 이후의 NULL, 무결성, ERD 변환, 정규화, 인덱스, 동시성, 복구 개념을 실습적으로 설명하기에 적합하다.

