# Yeonsik's Note — Codex 명령 명세서

## 0. 역할
너는 이 저장소를 맡은 시니어 풀스택 엔지니어이자 제품 디자이너다. 목표는 Yeonsik's Note를 단순 로컬 메모 앱이 아니라 Tauri v2 네이티브 경험과 Supabase 오프라인 퍼스트 동기화를 결합한 Life Command Center로 승격하는 것이다. 변경은 기능 추가보다 데이터 무결성, 플랫폼 호환성, 고급스러운 사용감, 유지보수성을 우선한다.

## 1. 절대 제약

1. Windows 데스크톱 앱, Windows 웹 앱, Android 앱에서 사용 가능한 현재 기능을 깨지 말 것.
2. Tauri 전용 기능은 반드시 desktop guard와 runtime feature detection을 둔다.
   - Rust: `#[cfg(desktop)]` 또는 OS별 cfg.
   - TypeScript: Tauri API dynamic import 실패 시 web/Android fallback.
3. web/Android에서는 global hotkey, tray, close-to-hide가 없거나 제한될 수 있으므로 앱이 crash하지 않고 해당 기능을 숨기거나 비활성 상태로 표시한다.
4. local-first는 유지한다. Supabase 설정 또는 인증이 없어도 메모, 체크리스트, 운동/식사/체중, 기록 조회는 동작해야 한다.
5. 기존 `deletedAt` tombstone 정책을 무시하는 hard delete를 만들지 말 것. 명시적 purge 기능이 아닌 이상 삭제는 soft delete다.
6. `Alt + Space` 글로벌 퀵 캡처는 Windows에서 충돌 가능성이 있으므로 등록 실패를 UX로 처리하고 설정에서 대체 단축키를 선택 가능하게 설계한다. 기본값은 사용자 요구대로 `Alt+Space`, fallback 제안은 `Ctrl+Alt+Space`.
7. 대형 리팩토링으로 기능을 한 번에 갈아엎지 말 것. 기존 `useLocalSyncMemo`를 facade로 유지하면서 내부를 단계적으로 분리한다.

## 2. 제품 방향

### 핵심 포지셔닝

Yeonsik's Note는 “메모를 적는 앱”이 아니라 “하루를 지휘하는 검은색 계기판”이다. 브랜드 톤은 Apple식 정밀함, Balenciaga식 절제와 강한 대비, 건강/생산성 데이터의 즉각적 피드백이다. 디자인은 장식보다 구조, 정보 밀도보다 위계, 색상보다 빛의 사용이 중요하다.

### 탭 전략

현재 4탭 구조는 유지한다.

- `기록`: 앱 진입 홈. Life Command Center. 조회 전용 캘린더에서 인라인 실행형 대시보드로 승격.
- `메모`: 깊은 작성과 체크리스트 관리. Quick Capture의 저장 대상.
- `운동`: 운동/식사/체중의 Full CRUD 및 통계/리포트/공유.
- `설정`: 인증, 동기화, 테마, 네이티브 기능, 단축키, 기기 관리.

`기록`을 없애지 말고 역할을 명확히 한다. 내부 route/key는 `records`를 유지해도 되지만 화면 헤드라인은 `Life Command Center` 또는 `Command Center`를 병기한다.

## 3. 디자인 명령

### 현재 화면에서 개선해야 할 문제

첨부 스크린샷 기준, 현재 UI는 검은 배경, cyan accent, 카드형 캘린더, 상태 pill, dot marker가 있어 방향성은 좋다. 그러나 아직 “로컬 메모 앱 UI”의 촘촘함이 남아 있다. 정보는 많지만 계기판의 위압감이 부족하고, 캘린더가 화면의 주인공이 되어야 할지 대시보드가 주인공이 되어야 할지 모호하다.

### 디자인 시스템

1. 배경은 pure black이 아니라 단계가 있는 matte black으로 구성한다.
   - app bg: near black
   - surface: black-green 또는 black-charcoal
   - elevated surface: border가 살아있는 graphite
2. Accent는 현재 cyan을 유지하되 더 고급스럽게 쓴다.
   - Primary: cyan/mint
   - Productivity: blue
   - Meal: amber
   - Workout: green
   - Weight: violet 또는 white
   - Danger/delete: muted red, hover에서만 선명하게
3. 버튼과 카드에는 두꺼운 glow를 남발하지 않는다. 1px hairline border, 낮은 opacity fill, 작은 scale/opacity transition을 사용한다.
4. Typography는 숫자 계기판을 강조한다.
   - KPI 숫자: tabular-nums
   - 설명 텍스트: 작고 절제
   - 제목: 강한 대비, 자간 약간 좁게
5. 월간 캘린더는 유지하되 상단에 dashboard band를 추가한다. 사용자는 앱을 열자마자 “오늘 내가 어느 상태인지”를 2초 안에 파악해야 한다.
6. Android와 좁은 width에서는 카드가 1열로 쌓이고, 데스크톱 넓은 width에서는 dashboard 12-column grid로 확장한다.

## 4. [기록 탭] Life Command Center 구현 명령

### 목표

`RecordsPanel`을 조회 화면에서 “시각화 + 즉시 실행” 화면으로 바꾼다.

### UI 구성

1. 상단 Hero / Today Brief
   - 오늘 날짜, 동기화 상태, “오늘 남은 일 N개”, “운동 기록 있음/없음”, “최근 체중 변화”를 한 줄로 보여준다.
   - 문구 예: `오늘의 지휘판`, `3 tasks left · 1 workout · synced`.

2. KPI 카드 4개
   - 생산성 스코어: 기간 내 완료한 할 일 / 전체 할 일.
   - 평균 칼로리: 선택 기간 meal 평균.
   - 평균 단백질: 선택 기간 meal 평균.
   - 체중 변화: 선택 기간 첫 체중 대비 마지막 체중 delta.
   - 데이터가 없으면 숫자 0보다 `—`와 empty microcopy를 사용한다.

3. 차트 영역
   - Weekly productivity bar 또는 ring.
   - Calories/protein trend.
   - Weight line trend.
   - 먼저 가벼운 SVG/React 구현 또는 이미 의존성이 있으면 기존 chart library 사용. 새 의존성은 최소화한다.
   - chart 로직은 UI 안에 직접 쓰지 말고 pure selector로 분리한다.

4. 캘린더
   - 현재 캘린더를 유지하되 날짜 셀에 dot marker legend를 명확히 한다.
   - hover/focus/selected/today 상태를 분리한다.
   - 날짜 클릭 시 아래 리스트로만 이동하지 말고 Quick Action Overlay를 띄운다.

5. Inline Quick Action Overlay
   - 날짜 셀 또는 선택 날짜 카드에서 열리는 compact modal/sheet.
   - 다른 탭으로 이동하지 않고 다음을 처리한다.
     - 할 일 완료 toggle.
     - 새 할 일 추가.
     - 메모 quick edit / quick add.
     - 운동/식사/체중 요약 보기.
     - 체중 값 수정.
   - Esc로 닫기, Enter 저장, focus trap, keyboard navigation을 구현한다.

### 데이터/성능

1. `src/features/records/recordAggregation.ts`를 만들고 다음 pure function을 구현한다.
   - `getRecordsForDate(snapshot, date)`
   - `getDashboardStats(snapshot, range)`
   - `getCalendarMarkers(snapshot, month)`
   - `getProductivitySeries(tasks, range)`
   - `getNutritionSeries(meals, range)`
   - `getWeightSeries(weights, range)`
2. 모든 selector는 `deletedAt === null`만 대상으로 한다.
3. date 비교는 timezone drift를 막기 위해 기존 date format 정책을 확인하고 local date 기준 helper로 통일한다.
4. React 컴포넌트에서는 `useMemo`를 사용해 월/기간/데이터 변경 시에만 집계한다.

## 5. [운동 탭] Full CRUD 및 Tombstone 삭제 명령

### 목표

운동/식사/체중 기록을 add-only에서 complete lifecycle로 전환한다.

### 도메인 액션

`useLocalSyncMemo` 또는 분리된 `useFitnessDomain`에 아래 액션이 최종적으로 노출되어야 한다.

- `addWorkoutRecord(input)`
- `updateWorkoutRecord(id, patch)`
- `deleteWorkoutRecord(id)`
- `addMealRecord(input)`
- `updateMealRecord(id, patch)`
- `deleteMealRecord(id)`
- `addWeightRecord(input)`
- `updateWeightRecord(id, patch)`
- `deleteWeightRecord(id)`

삭제는 반드시 다음처럼 처리한다.

- `deletedAt = nowIso()`
- `updatedAt = nowIso()`
- `deviceId = currentDeviceId`
- UI에서는 즉시 사라지되, Supabase에는 tombstone이 push되어 다른 기기에도 삭제가 전파된다.

### LWW 병합 정책

1. `updatedAt` 최신 row가 이긴다.
2. 같은 `updatedAt`이면 `deletedAt !== null`인 tombstone을 우선한다.
3. tombstone row는 sync/pull/realtime merge에서 보존한다.
4. UI 목록에는 tombstone을 노출하지 않는다.
5. Markdown export, dashboard stats, calendar marker도 tombstone 제외.

### UI

1. 각 운동/식사/체중 row 우측에 subtle `X` 또는 trash icon 버튼을 추가한다.
2. 삭제는 destructive hover에서만 붉게 보이게 한다.
3. 실수 방지를 위해 즉시 삭제 + 5초 undo toast를 우선 적용한다. Confirm modal 남발 금지.
4. row 클릭 또는 edit 버튼으로 inline edit mode를 연다.
5. 식사 UI에 `carbsGrams`, `fatGrams` 입력을 활성화한다.
   - Optional numeric.
   - 음수 불가.
   - 저장소 타입에 이미 있으면 schema/mapper 누락 여부만 확인한다.
6. 체중은 0보다 큰 값만 허용하고, 수정 시 기존 validation과 동일하게 처리한다.

## 6. [메모/체크리스트] 네이티브 Quick Capture 명령

### 목표

Tauri 데스크톱에서는 앱이 tray에 숨어 있어도 어디서나 빠르게 메모/할 일을 입력한다. web/Android에서는 같은 컴포넌트를 앱 내부 floating quick capture로 제공한다.

### Desktop 구현

1. `tauri-plugin-global-shortcut`을 추가한다.
2. Rust setup에서 `#[cfg(desktop)]`로 plugin을 초기화한다.
3. 기본 shortcut은 `Alt+Space`로 등록한다.
4. 등록 실패 시 설정 화면에 `Alt+Space is unavailable` 상태와 fallback 설정을 보여준다.
5. Quick Capture 전용 window를 만든다.
   - label: `quick-capture`
   - center, always-on-top, skip taskbar 가능하면 적용
   - blur/Esc/저장 후 hide
6. 입력 UX
   - 기본 모드: 할 일
   - `#memo` prefix 또는 토글로 메모 저장
   - Enter 저장, Shift+Enter 줄바꿈, Esc 닫기
   - 저장 즉시 local snapshot 업데이트, 이후 sync engine이 push
7. tray menu에 `Quick Capture`, `Open`, `Hide`, `Quit`를 추가한다.

### Web/Android fallback

1. Tauri API가 없으면 global shortcut 기능을 import하지 않는다.
2. 앱 내부에서 `Ctrl+K` 또는 floating button으로 Quick Capture를 연다.
3. Android에서는 소프트 키보드와 safe area를 고려해 bottom sheet로 표시한다.

## 7. 코드베이스 정제 명령

### 레거시 컴포넌트 정리

1. `NoteList`, `NoteEditor`, `TaskPanel`이 실제 import되지 않는지 전체 검색한다.
2. 미사용이면 삭제한다.
3. 재사용 가능성이 있는 UI primitive는 `components/`로 추출하고, 기능 컴포넌트 이름은 현재 사용되는 `MemoPanel`, `ChecklistPanel` 기준으로 통일한다.
4. 삭제 후 TypeScript build로 검증한다.

### 책임 분리

한 번에 훅을 갈아엎지 말고 아래 순서로 분리한다.

1. `src/features/records/recordAggregation.ts`
2. `src/features/fitness/fitnessService.ts`
3. `src/features/fitness/fitnessStats.ts`
4. `src/lib/sync/merge.ts`
5. `src/lib/auth/authSession.ts`
6. `src/app/useLocalSyncMemo.ts`는 당분간 facade로 유지

최종 목표 구조:

```text
src/
  app/
    App.tsx
    useAppData.ts 또는 useLocalSyncMemo.ts  # facade
  features/
    command-center/
      CommandCenterPanel.tsx
      widgets/
      quickActions/
    records/
      recordAggregation.ts
      calendarMarkers.ts
    notes/
      MemoPanel.tsx
      noteService.ts
    tasks/
      ChecklistPanel.tsx
      taskService.ts
    fitness/
      FitnessPanel.tsx
      fitnessService.ts
      fitnessStats.ts
      fitnessExport.ts
  lib/
    auth/
      authSession.ts
      authStorage.ts
    sync/
      syncEngine.ts
      merge.ts
      supabaseMappers.ts
    desktop/
      quickCapture.ts
      shortcuts.ts
      tray.ts
    platform/
      capabilities.ts
```

## 8. [인프라/공유] Supabase Auth, RLS, 공유 명령

### Auth/RLS

1. 설정 화면에서 manual `User ID` 입력 UI를 deprecated 처리한다.
2. Supabase Auth를 도입한다.
   - 이메일 magic link 또는 email/password.
   - Google OAuth.
   - web, Windows desktop, Android redirect URL을 분리 등록한다.
3. 모든 syncable table에 `user_id uuid not null references auth.users(id)`를 추가하는 migration을 작성한다.
4. 기존 개발 데이터는 migration helper로 현재 로그인 사용자에게 assign할 수 있게 한다.
5. 모든 table에 RLS enable.
6. policies:
   - select: `auth.uid() = user_id`
   - insert: `auth.uid() = user_id`
   - update: `auth.uid() = user_id` and `with check auth.uid() = user_id`
   - delete: 앱에서는 사용하지 않더라도 정책을 명확히 하거나 금지한다.
7. Supabase anon/publishable key는 secret이 아니지만 service_role key는 절대 클라이언트에 넣지 않는다.
8. localStorage 암호화는 “보안 기능”으로 과장하지 않는다. 같은 클라이언트에 key가 있으면 공격자를 완전히 막지 못한다. 토큰/민감 설정은 추후 OS secure storage adapter로 옮길 수 있게 인터페이스를 둔다.

### X 공유

1. MVP는 직접 X API post가 아니라 “공유 가능한 report 생성 → clipboard copy → X compose/share intent open”으로 구현한다.
2. 이유: direct posting과 media upload는 API key/secret 및 사용자 OAuth token이 필요하므로 클라이언트 단독 구현에 넣지 않는다.
3. 생성 포맷:
   - Text: 오늘의 생산성, 완료한 일 수, 운동 기록, 칼로리/단백질 요약, 해시태그.
   - Image: Command Center card를 PNG로 캡처. web/Android/Tauri 각각 fallback.
4. 버튼:
   - `Copy report`
   - `Copy image`
   - `Share to X`
5. 실패 fallback: 텍스트 복사만이라도 성공해야 한다.

## 9. 테스트 및 검증 명령

### 우선 테스트

1. `recordAggregation.test.ts`
   - 날짜별 marker 계산
   - tombstone 제외
   - productivity score 계산
2. `fitnessService.test.ts`
   - update/delete tombstone
   - carbs/fat validation
3. `merge.test.ts`
   - LWW
   - 같은 timestamp에서 tombstone 우선
4. `supabaseMappers.test.ts`
   - snake_case/camelCase 변환
   - user_id/device_id/deleted_at 누락 방지
5. `fitnessStats.test.ts`
   - 평균 칼로리/단백질
   - 체중 delta

### 필수 실행

Windows 기준:

```powershell
npm.cmd install
npm.cmd run build
cargo check
npm.cmd run tauri:dev
```

가능하면 추가:

```powershell
npm.cmd run test
npm.cmd run tauri:build
```

web/Android 유지 검증:

- Tauri API가 없는 browser dev server에서 화면 crash 없음.
- Android build target에서 desktop-only Rust code가 compile path에 들어가지 않음.
- Quick Capture fallback이 앱 내부에서 동작.

## 10. 작업 순서

### Phase 1 — Product shell & design foundation

1. 기록 탭 이름/역할을 Life Command Center로 확정.
2. dashboard widgets layout 추가.
3. `recordAggregation.ts` pure selectors 작성.
4. 캘린더 visual polish와 marker legend 정리.

### Phase 2 — Inline Quick Actions

1. 날짜 클릭 overlay/sheet 구현.
2. 할 일 완료 toggle, quick task add, memo quick edit/add, weight edit 연결.
3. keyboard/focus/escape 처리.

### Phase 3 — Fitness Full CRUD

1. update/delete service 추가.
2. tombstone sync merge 테스트 추가.
3. FitnessPanel row edit/delete UI 추가.
4. carbs/fat inputs 활성화.

### Phase 4 — Desktop native Quick Capture

1. global-shortcut plugin desktop-only 추가.
2. quick-capture window 구현.
3. tray menu 확장.
4. web/Android fallback component 적용.

### Phase 5 — Auth/RLS & share

1. Supabase Auth session layer.
2. schema migration + RLS policies.
3. user_id 기반 sync mapper 수정.
4. Life report text/image generator.
5. clipboard/share fallback 구현.

## 11. 완료 기준

1. 기록 탭 첫 화면에서 생산성, 식단, 체중, 일정 상태가 즉시 보인다.
2. 날짜 클릭만으로 할 일 완료, 메모 작성, 체중 수정이 가능하다.
3. 운동/식사/체중은 생성/조회/수정/삭제가 모두 가능하다.
4. 삭제는 모든 로컬/원격/다중 기기 경로에서 tombstone으로 전파된다.
5. Tauri desktop에서 Quick Capture가 동작하고, web/Android에서는 crash 없이 fallback이 동작한다.
6. Supabase Auth/RLS 전환 계획 또는 migration이 repo에 포함된다.
7. legacy component 정리 후 build가 통과한다.
8. 최소 핵심 테스트가 추가된다.
9. visual result는 “로컬 메모 앱”이 아니라 “블랙 프리미엄 대시보드”처럼 보여야 한다.

## 12. 하지 말 것

1. 음식 DB, AI 칼로리 추정, 웨어러블 연동, 이미지 업로드를 이번 범위에 넣지 말 것.
2. CRDT를 도입하지 말 것. MVP는 LWW + tombstone + 테스트로 충분하다.
3. localStorage를 즉시 SQLite/IndexedDB로 전환하지 말 것. 먼저 adapter 경계를 만든다.
4. 인증 전환 중 local-only 모드를 제거하지 말 것.
5. X API secret을 클라이언트에 넣지 말 것.
6. Android에서 desktop-only API 때문에 compile/runtime crash가 나게 하지 말 것.
