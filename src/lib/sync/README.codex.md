# Sync library maintenance notes

This directory owns the local-first/Supabase synchronization boundary.

Keep these contracts:

- `merge.ts` is the canonical LWW/tombstone rule.
- A tombstone wins when timestamps are equal.
- Supabase rows are soft-deleted; hard DELETE Realtime events are ignored.
- Row mappers own snake_case/camelCase conversion and legacy/null normalization.
- Pull, push, Realtime, presence, and finance queries stay behind `SyncClient`.
- After local snapshot hydration, pull/push/Realtime failure must not disable local editing or local persistence.
- Auth session initialization currently runs before local hydrate; its data-preservation fix is tracked in GitHub issue #31.
- Never place a service-role or secret key in the client runtime.

Current references:

- `docs/adr/2026-08-01-current-architecture.md`
- `supabase/README.codex.md`
- GitHub issue #27 for live RLS, Realtime, and cross-device verification
- GitHub issue #31 for local snapshot preservation when Auth initialization throws
