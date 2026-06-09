# Sync Library — Codex Notes

이 폴더는 Supabase pull/push/realtime merge와 LWW/tombstone 정책의 핵심 위치다.

해야 할 일:

```text
merge.ts 또는 기존 merge 함수 분리
LWW rule 명문화
동일 timestamp에서 tombstone 우선
snake_case/camelCase mapper에서 user_id/device_id/deleted_at 누락 방지
```

절대 금지:

```text
Supabase row를 hard delete하지 말 것.
클라이언트에 service_role key를 넣지 말 것.
Auth/RLS 도입 중 local-only mode를 제거하지 말 것.
```

관련 문서:

```text
docs/specs/fitness-full-crud-sync.md
docs/specs/auth-rls-share.md
```
