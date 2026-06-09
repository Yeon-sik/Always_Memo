# 노트북 이어서 작업할 내용 - Supabase 연계

## 0. 현재 판단

현재 Yeonsik's Note는 Supabase Auth 로그인 기반이 아니라 `USER_ID` 문자열 기반 동기화 구조다.

따라서 지금 할 일은:

1. Supabase DB 스키마를 현재 앱 구조에 맞게 업데이트한다.
2. 앱에 `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `USER_ID`를 설정한다.
3. 메모/할 일/운동/식단/체중 동기화와 tombstone 삭제 전파를 검증한다.

지금 하지 말아야 할 일:

1. `supabase/migrations/20260609_auth_rls_life_command_center.sql` 즉시 실행
2. RLS enable
3. `service_role` 또는 secret key를 앱에 넣기
4. `.env`, `dist`, `node_modules`, `.understand-anything`, `src-tauri/target` 커밋

## 1. 노트북에서 먼저 확인

repo 루트에서 실행:

```powershell
git status --short --branch
git pull --ff-only origin main
npm.cmd install
```

현재 PC에서 남아 있던 로컬 변경 참고:

```text
src-tauri/Cargo.toml 변경이 남아 있었음
.understand-anything/ 로컬 대시보드 산출물이 있었음
```

노트북에서는 이 둘을 작업 대상으로 삼지 않는 한 커밋하지 않는다.

## 2. Supabase 프로젝트에서 값 확보

Supabase Dashboard에서 확인:

```text
Project URL
anon key 또는 publishable key
```

절대 앱에 넣지 말 것:

```text
service_role key
secret key
```

## 3. Supabase SQL 적용

Supabase Dashboard -> SQL Editor -> New query에서 아래 파일 전체 내용을 실행한다.

```text
supabase/schema.sql
```

이 SQL이 맞춰주는 핵심:

```text
public.devices
public.notes
public.tasks
public.workout_records
public.meal_records
public.weight_records
deleted_at tombstone
created_at
is_backfilled
backfilled_at
backfill_reason
tasks.due_date
tasks.due_time
meal_records.carbs_grams
meal_records.fat_grams
sync용 index
supabase_realtime publication 등록
```

## 4. SQL 적용 확인

SQL Editor에서 실행:

```sql
select table_name
from information_schema.tables
where table_schema = 'public'
  and table_name in (
    'devices',
    'notes',
    'tasks',
    'workout_records',
    'meal_records',
    'weight_records'
  )
order by table_name;
```

```sql
select table_name, column_name, data_type
from information_schema.columns
where table_schema = 'public'
  and table_name in (
    'notes',
    'tasks',
    'workout_records',
    'meal_records',
    'weight_records'
  )
  and column_name in (
    'created_at',
    'deleted_at',
    'is_backfilled',
    'backfilled_at',
    'backfill_reason',
    'due_date',
    'due_time',
    'carbs_grams',
    'fat_grams'
  )
order by table_name, column_name;
```

```sql
select tablename
from pg_publication_tables
where pubname = 'supabase_realtime'
  and schemaname = 'public'
order by tablename;
```

기대 결과:

```text
devices
meal_records
notes
tasks
weight_records
workout_records
```

## 5. 앱 설정 파일 만들기

개발 실행용이면 repo 루트에 `.env`를 만든다.

```env
SUPABASE_URL=https://YOUR_PROJECT_REF.supabase.co
SUPABASE_ANON_KEY=YOUR_ANON_OR_PUBLISHABLE_KEY
USER_ID=yeonsik
```

여러 기기에서 같은 데이터를 공유하려면 같은 `USER_ID`를 사용한다.

```text
PC USER_ID=yeonsik
노트북 USER_ID=yeonsik
```

서로 분리하려면 다른 값을 쓴다.

```text
PC USER_ID=yeonsik
테스트 USER_ID=yeonsik-test
```

## 6. Windows 설치 앱용 런타임 env

설치된 Tauri 앱에서 쓸 때는 실행 시점 env 파일을 둔다.

예시:

```powershell
$env:YEONSIK_NOTE_ENV="C:\Users\YOUR_NAME\AppData\Roaming\YeonsikNote\yeonsik-note.env"
```

`yeonsik-note.env` 내용:

```env
SUPABASE_URL=https://YOUR_PROJECT_REF.supabase.co
SUPABASE_ANON_KEY=YOUR_ANON_OR_PUBLISHABLE_KEY
USER_ID=yeonsik
```

## 7. 앱 실행

웹 개발 서버:

```powershell
npm.cmd run dev
```

Tauri 개발 실행:

```powershell
npm.cmd run tauri:dev
```

검증 빌드:

```powershell
npm.cmd run test
npm.cmd run build
cd src-tauri
cargo check
cd ..
```

## 8. 단일 기기 Supabase 쓰기 검증

앱에서 순서대로 추가:

1. 메모 1개
2. 할 일 1개
3. 운동 1개
4. 식단 1개
5. 체중 1개

Supabase Table Editor에서 확인:

```text
notes row 생성
tasks row 생성
workout_records row 생성
meal_records row 생성
weight_records row 생성
devices row 생성
```

## 9. 삭제 tombstone 검증

앱에서 각 항목을 삭제한다.

Supabase에서 확인할 것:

```text
row가 사라지면 안 됨
deleted_at 값이 채워져야 함
updated_at 값이 갱신되어야 함
```

확인 SQL:

```sql
select id, user_id, updated_at, deleted_at
from public.notes
where user_id = 'yeonsik'
order by updated_at desc
limit 10;
```

운동/식단/체중도 같은 방식:

```sql
select id, user_id, date, updated_at, deleted_at
from public.workout_records
where user_id = 'yeonsik'
order by updated_at desc
limit 10;
```

```sql
select id, user_id, date, updated_at, deleted_at
from public.meal_records
where user_id = 'yeonsik'
order by updated_at desc
limit 10;
```

```sql
select id, user_id, date, updated_at, deleted_at
from public.weight_records
where user_id = 'yeonsik'
order by updated_at desc
limit 10;
```

## 10. 누락 보강 검증

지난 날짜에서 누락 보강으로 메모/할 일/운동/식단/체중을 추가한다.

Supabase에서 확인:

```text
is_backfilled = true
backfilled_at is not null
backfill_reason is not null
```

확인 SQL:

```sql
select id, user_id, is_backfilled, backfilled_at, backfill_reason
from public.notes
where user_id = 'yeonsik'
order by updated_at desc
limit 10;
```

## 11. 두 기기 Realtime 검증

PC와 노트북 모두 같은 값을 사용:

```env
USER_ID=yeonsik
```

테스트:

1. PC에서 메모 추가 -> 노트북에 반영되는지 확인
2. 노트북에서 할 일 완료 토글 -> PC에 반영되는지 확인
3. PC에서 운동 삭제 -> 노트북 UI에서 사라지는지 확인
4. 노트북에서 식단 추가 -> PC 기록 탭 marker에 반영되는지 확인
5. 체중 추가/수정 후 양쪽에 반영되는지 확인

Realtime이 바로 안 되면:

```text
1. Supabase Realtime publication에 테이블이 들어갔는지 확인
2. 두 앱의 USER_ID가 같은지 확인
3. 두 앱이 같은 Supabase project URL을 보고 있는지 확인
4. 브라우저/앱을 새로고침해서 pull sync가 되는지 확인
```

## 12. Auth/RLS 전환은 다음 단계

지금 실행하지 말 것:

```text
supabase/migrations/20260609_auth_rls_life_command_center.sql
```

이유:

```text
현재 앱: user_id text + USER_ID 수동 설정
Auth/RLS 초안: user_id uuid + auth.users(id) + auth.uid()
```

Auth/RLS로 넘어갈 때 필요한 순서:

1. Supabase Auth 로그인 UI 추가
2. `supabase.auth.getSession()` 기반 사용자 id 확보
3. `USER_ID` 수동 입력 UI deprecated
4. sync context의 `userId`를 Auth user id로 교체
5. 기존 text `user_id` 데이터를 uuid 사용자 id로 backfill
6. RLS enable
7. select/insert/update policy 적용
8. anon key로 다른 사용자 데이터 접근 불가 검증
9. local-only fallback 유지

## 13. 커밋/푸시 주의

커밋하면 안 되는 것:

```text
.env
dist/
node_modules/
.understand-anything/
src-tauri/target/
*.exe
*.msi
```

커밋 전 확인:

```powershell
git status --short
git check-ignore -v .env dist node_modules .understand-anything src-tauri/target
```

Supabase 설정값은 절대 커밋하지 않는다.

## 14. 최종 성공 기준

작업이 끝났다고 판단할 조건:

```text
메모/할 일/운동/식단/체중 row가 Supabase에 생성된다.
삭제 시 row가 사라지지 않고 deleted_at이 채워진다.
지난 날짜 누락 보강 기록에 is_backfilled=true가 들어간다.
두 기기에서 같은 USER_ID로 Realtime 반영이 된다.
Supabase 설정이 없어도 앱은 local-only로 계속 동작한다.
npm.cmd run test 통과
npm.cmd run build 통과
src-tauri cargo check 통과
```

