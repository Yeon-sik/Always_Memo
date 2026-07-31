# Supabase 운영 가이드

이 디렉터리는 Personal OS와 FitnessApp이 공유하는 Supabase schema, forward migration과 동기화 계약을 보관합니다. Git에 있는 SQL은 저장소 증거이며 특정 local, staging 또는 production 프로젝트에 적용되었다는 증거가 아닙니다.

## 현재 계약

- 앱은 Supabase 설정이 없어도 local-only로 동작합니다.
- 원격 동기화는 Supabase Auth session이 있을 때만 허용합니다.
- 수동 `USER_ID` 설정은 지원하지 않습니다.
- DB `user_id`는 `auth.users.id`를 text로 저장하고 RLS에서 `auth.uid()::text`와 비교합니다.
- 삭제는 hard delete가 아니라 `deleted_at` tombstone으로 전파합니다.
- 기본 병합은 `updated_at` Last Write Wins이며 같은 timestamp에서는 tombstone을 우선합니다.
- anon/publishable key는 client identifier일 뿐 권한이 아닙니다. service-role key는 클라이언트와 저장소에 두지 않습니다.

## 파일의 역할

| 경로 | 역할 | 운영 기준 |
| --- | --- | --- |
| `schema.sql` | 현재 개발 schema의 전체 bootstrap snapshot | 빈 격리 프로젝트를 만들거나 현재 구조를 검토할 때 사용 |
| `migrations/*.sql` | 기존 DB에 적용할 timestamped forward history | 이미 운영 중인 프로젝트의 변경 기준 |
| `LEGACY_USER_BACKFILL_TEMPLATE.sql` | legacy owner를 실제 Auth user에 연결하기 위한 검토용 template | 값과 대상 row를 확인한 뒤 별도 승인 하에 사용 |

현재 migration 집합만으로 빈 DB의 초기 table을 모두 생성하지는 않습니다. 초기 table 생성은 `schema.sql`에 있고 초기 migration baseline은 없습니다. 따라서 빈 프로젝트와 기존 프로젝트의 절차를 섞지 않습니다.

## 현재 migration ledger

| Migration | 목적 |
| --- | --- |
| `20260609_auth_rls_life_command_center.sql` | 잘못된 초기 Auth/RLS 초안을 실행하지 않도록 남긴 historical no-op marker |
| `20260609_backfill_data_trust.sql` | 누락 보강 metadata와 index 추가 |
| `20260610060733_capture_remote_update.sql` | 과거 Dashboard 변경을 표시하는 no-op marker |
| `20260613_cardio_metrics.sql` | 운동 시간과 평균 심박수 추가 |
| `20260705_today_tasks_planned_date.sql` | 할 일 계획일과 index 추가 |
| `20260708090000_add_detailed_fitness_tables.sql` | FitnessApp 상세 운동 table과 공유 scope 추가 |
| `20260709114500_add_fitness_workout_totals.sql` | 운동 합계 volume field 추가 |
| `20260724120000_freeze_fitness_record_v1.sql` | Fitness Record Contract v1 제약 고정 |
| `20260724121000_enable_authenticated_rls.sql` | Auth 소유권 검증, anon 회수, authenticated CRUD RLS 활성화 |

`20260609` prefix가 중복된 historical 파일 두 개가 있으므로 연결된 프로젝트의 migration history를 확인하지 않은 채 `db push`하지 않습니다. `migration repair`도 실제 적용 사실과 timestamp를 확인한 경우에만 사용합니다.

## migration-first 표준 흐름

DB를 바꾸기 전에 먼저 migration을 만듭니다.

```powershell
git status --short
npx.cmd supabase migration new describe_the_change
```

생성된 `supabase/migrations/<timestamp>_describe_the_change.sql`에 실제 SQL을 작성합니다. 가능하면 재실행 안전한 guard를 사용하되, guard가 잘못된 schema를 숨기지 않는지도 검토합니다.

```sql
alter table public.tasks
  add column if not exists example_text text;
```

그 다음 순서로 검증합니다.

1. migration SQL과 rollback/forward-fix 전략을 review합니다.
2. 격리된 local 또는 staging DB에 적용합니다.
3. schema, constraint, index, RLS와 Realtime 결과를 확인합니다.
4. `schema.sql` snapshot도 같은 최종 구조로 갱신합니다.
5. 앱 mapper, snapshot normalize, push/pull, Realtime test를 함께 실행합니다.
6. production 적용은 backup과 명시적 승인 후 진행합니다.

Dashboard SQL Editor에서 먼저 변경하지 않습니다. 불가피하게 먼저 실행했다면 실행한 SQL을 그대로 migration에 복구하고 원격 history와 대조합니다. 정확한 SQL을 회수하지 못한 no-op marker는 새 변경을 대신할 수 없습니다.

## 빈 격리 프로젝트 bootstrap

빈 local/staging 프로젝트에서는 `schema.sql` 전체를 review한 뒤 적용합니다. 이 파일에는 현재 table, index, Realtime publication, grant와 RLS policy가 포함됩니다.

적용 후 최소한 다음을 확인합니다.

```sql
select table_name
from information_schema.tables
where table_schema = 'public'
  and table_name in (
    'devices',
    'notes',
    'tasks',
    'workout_records',
    'workout_exercises',
    'workout_sets',
    'meal_records',
    'weight_records'
  )
order by table_name;
```

`schema.sql`을 기존 운영 프로젝트에 통째로 다시 실행하는 것을 기본 migration 절차로 사용하지 않습니다.

## 기존 프로젝트 적용 순서

1. 대상 환경과 project ref를 확인합니다.
2. DB를 backup합니다.
3. local 파일과 remote migration history를 대조합니다.

```powershell
npx.cmd supabase link --project-ref YOUR_PROJECT_REF
npx.cmd supabase migration list
```

4. 모든 app table의 `user_id`가 실제 `auth.users.id`에 대응하는지 확인합니다.
5. legacy single-user row가 있으면 `LEGACY_USER_BACKFILL_TEMPLATE.sql`을 복사해 값을 채우고 review합니다.
6. timestamp 순서의 unapplied migration만 staging에서 먼저 실행합니다.
7. `20260724121000_enable_authenticated_rls.sql`이 owner 검증을 통과하는지 확인합니다. 검증 실패를 우회하지 않습니다.
8. 두 Auth 계정과 unauthenticated client로 RLS를 검증합니다.
9. 앱 pull, push, Realtime, tombstone과 active-device heartbeat를 확인합니다.

네트워크 연결이나 production 적용은 local 문서 정리의 일부가 아닙니다. 실행했다면 대상 환경, migration list와 검증 query 결과를 별도 배포 증거로 남깁니다.

## Auth와 RLS 검증

repository schema는 다음 table에서 anon 권한을 회수하고 authenticated role만 허용합니다.

```text
devices
notes
tasks
workout_records
workout_exercises
workout_sets
meal_records
weight_records
```

RLS 활성화 확인:

```sql
select schemaname, tablename, rowsecurity
from pg_tables
where schemaname = 'public'
  and tablename in (
    'devices', 'notes', 'tasks', 'workout_records',
    'workout_exercises', 'workout_sets', 'meal_records', 'weight_records'
  )
order by tablename;
```

policy 확인:

```sql
select schemaname, tablename, policyname, roles, cmd
from pg_policies
where schemaname = 'public'
order by tablename, policyname;
```

필수 runtime 시나리오:

- unauthenticated client가 app table을 읽거나 쓰지 못한다.
- account A가 account B row를 select, insert, update, delete하지 못한다.
- `workout_exercises`가 다른 사용자의 `workout_records` parent를 참조하지 못한다.
- `workout_sets`가 다른 사용자의 `workout_exercises` parent를 참조하지 못한다.
- 동일 계정의 정상 CRUD와 tombstone update는 성공한다.

SQL 정의만으로 이 시나리오가 실제 프로젝트에서 통과했다고 간주하지 않습니다.

## Realtime 검증

```sql
select tablename
from pg_publication_tables
where pubname = 'supabase_realtime'
  and schemaname = 'public'
order by tablename;
```

기대 table:

```text
devices
meal_records
notes
tasks
weight_records
workout_exercises
workout_records
workout_sets
```

publication에 table이 있어도 Realtime consumer가 정상 병합한다고 자동 증명되지는 않습니다. 같은 Auth 계정의 두 client에서 INSERT, UPDATE와 tombstone이 중복 없이 수렴하는지 확인합니다.

## FitnessApp 공유 계약

- `workout_records`는 Personal OS가 읽는 session/event parent입니다.
- `workout_exercises`, `workout_sets`는 FitnessApp이 소유하는 detail입니다.
- 완료된 FitnessApp session은 `scope = 'both'`, 진행 중 session은 `scope = 'fitness'`를 사용합니다.
- 새 write는 `contract_version = 1`을 기록합니다.
- 상세 계약은 `docs/FITNESS_RECORD_CONTRACT_V1.md`를 기준으로 합니다.

## CashOS finance summary 계약

Personal OS의 finance calendar는 외부 `finance_summary_daily` view를 read-only로 조회합니다.

```text
date
user_id
income_krw
expense_krw
net_krw
entry_count
```

이 view는 CashOS migration이 소유하며 이 저장소의 `schema.sql`이 만들지 않습니다. PostgreSQL view 자체에 RLS policy를 둔다는 의미가 아닙니다. CashOS 쪽에서 `security_invoker = true` view, 기반 table의 사용자 RLS, anon 권한 회수와 authenticated `SELECT` grant가 함께 적용되고, 두 앱이 같은 Supabase 프로젝트와 같은 Auth account를 사용할 때만 안전하게 동작합니다. 같은 fixture의 날짜 범위와 합계를 양쪽에서 비교하기 전에는 cross-repository 연동을 완료로 표시하지 않습니다.

## schema snapshot 관리

`schema.sql`은 현재 구조를 빠르게 검토하고 빈 격리 환경을 bootstrap하기 위한 snapshot입니다. 운영 변경 이력은 migration이 우선합니다.

원격 dump를 사용할 때는 대상 프로젝트와 생성 diff를 먼저 확인합니다.

```powershell
npx.cmd supabase db dump --linked --schema public -f supabase/schema.sql
git diff -- supabase/schema.sql
```

`schema.sql`만 바뀌고 대응 migration이 없으면 기존 DB에 적용할 변경 이력이 부족합니다.

## 커밋 전 체크

```powershell
git status --short
git diff -- supabase/migrations
git diff -- supabase/schema.sql
git diff -- supabase/README.codex.md
```

포함 가능한 범위:

- `supabase/migrations/*.sql`
- `supabase/schema.sql`
- 이 운영 문서
- 해당 DB 계약과 직접 연결된 mapper/test

포함하지 않는 범위:

- `.env`와 token/key
- `supabase/.temp/`
- `node_modules/`, `dist/`, `src-tauri/target/`
- unrelated 앱 변경

Supabase 변경은 작은 독립 commit으로 유지하고, 적용 환경과 검증 결과는 PR 또는 배포 기록에 남깁니다.
