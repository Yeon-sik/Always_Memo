# Supabase — Codex Notes

현재 Supabase는 선택 동기화이며 local-only fallback이 반드시 유지되어야 한다.

Auth/RLS 전환은 실제 프로젝트에 바로 적용하지 말고 다음 순서로 진행한다.

```text
1. 현재 schema.sql 확인
2. 기존 데이터 백업
3. user_id backfill 전략 결정
4. RLS policy staging 적용
5. anon key로 cross-user 접근 불가 검증
6. 앱 mapper에서 user_id 누락 방지
```

`migrations/20260609_auth_rls_life_command_center.sql`은 초안이다. 실제 적용 전 테이블/컬럼명을 현재 schema와 대조한다.
