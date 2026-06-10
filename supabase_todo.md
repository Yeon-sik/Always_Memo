# Supabase 변경 기록 운영 TODO

이 문서는 Supabase SQL 변경을 앞으로 Git 기록에 남기기 위한 작업 순서와, 오늘 겪었던 예외상황을 정리한 운영 메모다.

핵심 원칙:

- DB를 바꾸기 전에 먼저 migration 파일을 만든다.
- Supabase Dashboard에서 직접 SQL을 실행했다면, 그 SQL도 반드시 migration 파일로 남긴다.
- `supabase/.temp/`는 CLI 연결 캐시이므로 커밋하지 않는다.
- Supabase 관련 커밋에는 앱 코드 변경을 섞지 않는다.

## 1. 작업 전 상태 확인

```powershell
git status --short
Get-ChildItem supabase\migrations
```

확인할 것:

- 작업트리에 unrelated 변경이 있는지 확인한다.
- `src-tauri/Cargo.toml` 같은 앱 코드 변경은 Supabase migration 커밋에 섞지 않는다.
- `supabase/.temp/`가 보이면 `.gitignore`에 들어가 있는지 확인한다.

예외상황:

- `src-tauri/Cargo.toml`이 modified로 보이지만 실제 diff가 없을 수 있다. 줄바꿈 경고일 수 있으니 `git diff -- src-tauri/Cargo.toml`로 확인한다.
- `supabase/.temp/`가 `??`로 보이면 커밋 대상이 아니다. `.gitignore`에 아래 항목을 추가한다.

```gitignore
supabase/.temp/
```

## 2. Supabase 프로젝트 연결 확인

처음 한 번만 로그인한다.

```powershell
npx.cmd supabase login
```

프로젝트 연결:

```powershell
npx.cmd supabase link --project-ref ntuusosrowlgdsyvpqbf
```

주의:

- `--project-ref`에는 전체 URL을 넣지 않는다.
- `https://ntuusosrowlgdsyvpqbf.supabase.co`가 URL이라면 project ref는 `ntuusosrowlgdsyvpqbf`다.
- 문서의 `<project-ref>` 표기는 실제로 `<`, `>`를 입력하라는 뜻이 아니다.

예외상황:

- `npx.cmd supabase link --project-ref <https://...>`처럼 입력하면 잘못된 값이다.
- PowerShell에서 `<migration_timestamp>`처럼 `<`, `>`를 그대로 입력하면 리다이렉션 연산자로 해석되어 에러가 난다.

잘못된 예:

```powershell
npx.cmd supabase migration repair --status applied <migration_timestamp>
```

올바른 예:

```powershell
npx.cmd supabase migration repair 20260610060733 --status applied
```

## 3. 앞으로의 표준 흐름: migration-first

DB를 바꾸기 전에 migration 파일을 먼저 만든다.

```powershell
npx.cmd supabase migration new add_example_column
```

생성된 파일:

```text
supabase/migrations/<timestamp>_add_example_column.sql
```

그 파일 안에 SQL을 작성한다.

예:

```sql
alter table public.tasks
  add column if not exists example_text text;
```

그 다음 Supabase SQL Editor에서 같은 SQL을 실행하거나, Docker 환경이 준비된 뒤 CLI로 적용한다.

커밋:

```powershell
git add supabase/migrations
git commit -m "chore: add Supabase migration for example column"
```

예외상황:

- migration 파일만 만들고 SQL을 안 넣으면 기록 가치가 없다.
- 이미 Dashboard에서 SQL을 먼저 실행했다면, 같은 SQL을 migration 파일에 넣고 그 migration을 원격에서 applied로 표시해야 할 수 있다.
- 이미 적용된 SQL을 다시 `db push`하면 중복 적용 문제가 날 수 있으므로, `add column if not exists`, `create index if not exists`, `drop policy if exists`처럼 가능하면 재실행 안전한 SQL을 쓴다.

## 4. 이미 Dashboard에서 SQL을 먼저 실행한 경우

원칙적으로는 SQL Editor에서 실행했던 SQL을 그대로 migration 파일로 남긴다.

```powershell
npx.cmd supabase migration new capture_manual_dashboard_update
```

생성된 파일에 실행했던 SQL을 붙여넣는다.

원격 DB에는 이미 적용된 변경이라면 migration history를 맞춘다.

```powershell
npx.cmd supabase migration repair <timestamp> --status applied
```

예:

```powershell
npx.cmd supabase migration repair 20260610060733 --status applied
```

확인:

```powershell
npx.cmd supabase migration list
```

예외상황:

- 오늘처럼 정확한 SQL을 회수하지 못했다면 no-op placeholder migration을 남기고, 다음 변경부터 migration-first로 관리한다.
- no-op placeholder는 아래처럼 의도를 명확히 적는다.

```sql
-- No-op placeholder.
--
-- This migration timestamp was marked as applied after manual Supabase SQL
-- changes were made directly in the dashboard. The exact SQL was not captured
-- at the time, so future schema changes should be recorded migration-first.
```

## 5. 원격과 로컬 차이를 자동으로 뽑고 싶은 경우

Docker Desktop이 설치되어 있고 실행 중이면 아래 명령을 사용할 수 있다.

```powershell
npx.cmd supabase db diff --linked --schema public -f capture_remote_update
```

성공하면 새 migration 파일이 생성된다.

```text
supabase/migrations/<timestamp>_capture_remote_update.sql
```

확인:

```powershell
git status --short
Get-ChildItem supabase\migrations
```

예외상황:

- Docker Desktop이 없거나 실행 중이 아니면 아래와 비슷한 에러가 난다.

```text
failed to inspect docker image
open //./pipe/docker_engine: The system cannot find the file specified.
Docker Desktop is a prerequisite for local development.
```

대응:

1. Docker Desktop 설치
2. Docker Desktop 실행
3. 엔진이 완전히 켜진 뒤 확인

```powershell
docker version
docker ps
```

4. 다시 실행

```powershell
npx.cmd supabase db diff --linked --schema public -f capture_remote_update
```

Docker를 쓰지 않을 경우:

- 자동 diff 대신 수동 migration을 만든다.
- SQL Editor에서 실행한 SQL을 migration 파일에 직접 남긴다.

## 6. db pull 사용 시 주의

```powershell
npx.cmd supabase db pull
```

`db pull`은 원격 스키마를 가져오는 데 도움을 주지만, 상황에 따라 기대한 migration 파일이 바로 생기지 않을 수 있다.

확인:

```powershell
git status --short
Get-ChildItem supabase\migrations
```

예외상황:

- `supabase/.temp/`만 생기고 migration 파일은 안 생길 수 있다.
- `.temp`는 migration 기록이 아니다.
- `supabase/migrations`에 새 `.sql` 파일이 생겨야 migration 기록이 생긴 것이다.

## 7. migration list 해석

```powershell
npx.cmd supabase migration list
```

예:

```text
Local          | Remote         | Time (UTC)
---------------|----------------|---------------------
20260609       |                | 20260609
20260609       |                | 20260609
20260610060733 | 20260610060733 | 2026-06-10 06:07:33
```

해석:

- Local과 Remote가 모두 있으면 로컬 파일과 원격 적용 기록이 맞는 상태다.
- Local만 있고 Remote가 비어 있으면 원격에는 적용 기록이 없는 상태다.
- Remote만 있고 Local이 비어 있으면 로컬에 대응 migration 파일이 없는 상태다.

예외상황:

- 기존 `20260609` migration 두 개처럼 같은 timestamp가 있으면 migration 관리가 애매해진다.
- 이 상태에서 무작정 `db push`하지 않는다.
- 이미 운영 DB에 반영된 내용인지, draft로만 보관할 내용인지 먼저 정리한다.

## 8. schema.sql 관리

`supabase/schema.sql`은 현재 스키마 스냅샷으로만 본다.

원격 스키마 스냅샷을 갱신하고 싶을 때:

```powershell
npx.cmd supabase db dump --linked --schema public -f supabase/schema.sql
```

확인:

```powershell
git diff -- supabase/schema.sql
```

예외상황:

- `schema.sql`만 바뀌고 migration이 없으면 변경 이력이 부족하다.
- 운영 관리 기준에서는 migration 파일이 우선이고, `schema.sql`은 참고용 스냅샷이다.

## 9. Realtime publication 확인

Supabase Realtime 등록은 자동 diff에서 놓칠 수 있으므로 SQL로 직접 확인한다.

```sql
select tablename
from pg_publication_tables
where pubname = 'supabase_realtime'
  and schemaname = 'public'
order by tablename;
```

기대 테이블:

```text
devices
meal_records
notes
tasks
weight_records
workout_records
```

예외상황:

- 테이블이 빠져 있으면 앱 간 실시간 반영이 안 될 수 있다.
- migration에 `alter publication supabase_realtime add table ...`를 추가할 때는 이미 등록된 테이블에 대해 중복 에러가 나지 않도록 `do $$ begin ... end $$;` 또는 수동 확인 후 적용한다.

## 10. 커밋 전 최종 체크리스트

```powershell
git status --short
git diff -- supabase/migrations
git diff -- supabase/schema.sql
git diff -- .gitignore
```

커밋에 포함할 수 있는 것:

- `supabase/migrations/*.sql`
- `supabase/schema.sql`
- `.gitignore`
- Supabase 운영 문서

커밋에 섞지 않을 것:

- `.env`
- `node_modules/`
- `dist/`
- `supabase/.temp/`
- `src-tauri/target/`
- Supabase와 무관한 앱 코드 변경

커밋 예:

```powershell
git add supabase/migrations supabase/schema.sql .gitignore supabase_todo.md
git commit -m "chore: document Supabase migration workflow"
```

## 11. 오늘 상태 메모

오늘 발생한 일:

- `supabase link` 후 `supabase/.temp/`가 생겼다.
- `.temp`는 migration이 아니라 CLI 캐시다.
- `db diff --linked`는 Docker Desktop이 없거나 실행 중이 아니어서 실패했다.
- `migration new capture_remote_update`로 `20260610060733_capture_remote_update.sql`가 생성됐다.
- `migration repair 20260610060733 --status applied`로 원격 migration history에는 applied로 기록됐다.
- 정확한 SQL을 회수하지 못해 해당 migration은 no-op placeholder로 남기는 방향이 현실적이다.

앞으로의 결정:

- 이전에 수동으로 꼬인 내용은 더 파고들지 않는다.
- 다음 Supabase 변경부터는 반드시 migration-first로 남긴다.
- SQL Editor에서 직접 실행하더라도 같은 SQL을 migration 파일에 먼저 작성한다.
