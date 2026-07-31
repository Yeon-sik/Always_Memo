# Fitness feature maintenance notes

This directory owns Personal OS workout, meal, and weight records plus their summaries and exports.

Keep these contracts:

- Record deletion is a tombstone update, never a hard delete.
- Every mutation updates `updatedAt` and `deviceId`.
- Summary, calendar, and export selectors exclude tombstones.
- Shared completed workouts can be displayed from FitnessApp; in-progress exercise/set detail remains FitnessApp-owned.
- Date/backfill metadata remains controlled by the calling panel, while form validation stays in the draft helpers.

Current references:

- `docs/adr/2026-08-01-current-architecture.md`
- `docs/specs/fitness-tab.md`
- GitHub issue #28 for remaining edit UI and Life Report/share work
