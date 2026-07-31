# Personal OS + FitnessApp Release Readiness

Target version: 1.0.0
Code baseline date: 2026-07-24

This document separates repository evidence from deployment evidence. A green
code build does not prove that a particular Supabase project, signing identity,
store listing, or physical device is configured correctly.

## Implemented code gates

- Fitness record contract v1 is frozen in code, SQLite, PostgreSQL schema, and
  a forward migration.
- Stable category codes are stored separately from Korean display labels.
- Completed FitnessApp workouts publish compact parent summaries to Personal
  OS while detailed exercises and sets remain FitnessApp-owned.
- Supabase synchronization requires an authenticated access token. Manual
  `USER_ID + anon key` authorization has been removed.
- Production RLS revokes `anon` table access, limits every exposed table to
  `auth.uid()::text = user_id`, and verifies detailed workout parent ownership.
- The RLS migration stops instead of orphaning legacy data when ownership has
  not been backfilled to a real Auth user.
- Desktop account binding and Android account binding reject silent switching
  of an existing local database to another account.
- Android refresh/access tokens are encrypted with Android Keystore. Passwords
  are never persisted.
- Android cleartext traffic and application backup are disabled.
- Tauri has an explicit CSP and does not accept `USER_ID` from runtime config.
- Android release builds require signing environment variables and fail closed
  when they are missing.
- Weight logging supports the six v1 record types, validates required values,
  preserves optional RPE/rest, and labels summaries by record type.
- Epley estimated 1RM and external-load volume UI are restricted to ordinary
  `weight_reps` records. They are estimates, not direct strength measurements,
  and are not applied to assisted, timed, or reps-only records.

## Required deployment sequence

1. Back up the production database.
2. Create or identify the production user in Supabase Auth.
3. For an existing single-user database, review and run
   `supabase/LEGACY_USER_BACKFILL_TEMPLATE.sql`.
4. Apply migrations in timestamp order. The RLS activation migration must pass
   without bypassing its ownership checks.
5. Test with two real Auth accounts:
   - account A cannot select, insert, update, or delete account B rows;
   - a workout child cannot reference another account's parent;
   - an unauthenticated request cannot access any app table.
6. Log both apps into the same account and verify:
   - Personal OS quick strength/cardio record appears in FitnessApp;
   - a completed FitnessApp strength session appears in Personal OS by body
     part only;
   - an in-progress FitnessApp session is not published to Personal OS;
   - edits and tombstones converge after sync.
7. Configure production signing:
   - Android: set `FITNESS_RELEASE_STORE_FILE`,
     `FITNESS_RELEASE_STORE_PASSWORD`, `FITNESS_RELEASE_KEY_ALIAS`, and
     `FITNESS_RELEASE_KEY_PASSWORD`;
   - Windows: configure a trusted Authenticode certificate for the Tauri/NSIS
     artifact.
8. Run physical-device and installed-binary smoke tests before rollout.

## Commercial launch gates outside this repository

- Publish a privacy policy covering workout, body-weight, nutrition, device,
  and authentication data.
- Complete the applicable store privacy/data-safety declarations.
- Define account/data deletion and support procedures. The client does not ship
  a service-role key; server-side account deletion must remain a protected
  backend operation.
- Confirm commercial rights for the exercise catalog text and any future
  images, video, branding, or third-party content.
- Review dependency licenses and retain required notices.
- Do not market estimated 1RM, volume, RPE, calorie, or recovery outputs as
  medical diagnosis or guaranteed performance outcomes.

## Repeatable verification

```powershell
cd C:\Github\personal-os\PersonalOSApp
npm.cmd test -- --run
npm.cmd run build
npm.cmd run tauri:build
npm.cmd run release:verify-windows

cd C:\Github\personal-os\FitnessApp
.\gradlew.bat testDebugUnitTest assembleDebug
.\gradlew.bat assembleRelease
```

`assembleRelease` is expected to fail when signing variables are absent. That
failure is the release safety gate, not a build defect.
