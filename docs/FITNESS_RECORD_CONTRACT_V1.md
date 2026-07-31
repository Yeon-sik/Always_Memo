# Fitness Record Contract v1

Status: frozen for new writes. Legacy rows remain readable and are normalized at
the application boundary.

## Authority and ownership

- `workout_records` is the shared session/event parent used by Personal OS.
- `workout_exercises` and `workout_sets` are FitnessApp-owned detail rows.
- Personal OS shows only the compact parent summary. FitnessApp may load the
  detailed children.
- A completed FitnessApp session publishes its parent with `scope = both`.
  An in-progress session stays `scope = fitness`.
- Every new shared record writes `contract_version = 1`.

## Stable category identity

The localized `category` column remains for backwards compatibility. New
workout metadata also carries stable identifiers:

```json
{
  "contract_version": 1,
  "category_codes": ["chest", "back"],
  "os_categories": ["가슴", "등"]
}
```

Strength codes are `chest`, `back`, `legs`, `shoulders`, `abs`, `triceps`, and
`biceps`. Top-level non-strength codes are `cardio` and `other`. Cardio subtype
labels such as running remain in `category`; they are not silently collapsed
into a strength category.

## Exercise and set types

`record_type` is one of:

- `weight_reps`
- `reps_only`
- `time`
- `weight_time`
- `assisted_weight_reps`
- `bodyweight_added_weight_reps`

Set numeric values cannot be negative. `rpe`, when present, is an integer from
1 to 10. A set is complete only when all fields required by its `record_type`
are valid. Missing values stay `null`; they are not converted to zero.

## Compatibility rule

Readers accept missing `contract_version`, missing metadata codes, and the
legacy `sets_reps_weight` type. Writers always emit v1. A future breaking
change requires a new version and a version-aware reader; v1 meaning must not
be changed in place.

## Security boundary

The anonymous project key is a public client identifier, not user
authorization. Production sync requires a Supabase Auth access token and RLS
policies matching `auth.uid()::text = user_id`. A service-role key must never
be shipped in either client.
