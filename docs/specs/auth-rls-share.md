# Spec — Supabase Auth/RLS & Life Report Share

## 1. 목적

개발용 `USER_ID` 기반 동기화에서 벗어나, 개인 데이터 접근 경계를 Supabase Auth + RLS로 닫는다. 동시에 오늘의 생산성/운동 결과를 공유 가능한 Life Report로 만든다.

## 2. Auth

설정 화면의 manual `User ID` 입력 UI는 deprecated 처리한다.

지원 우선순위:

```text
1. Email magic link 또는 email/password
2. Google OAuth
3. web / Windows desktop / Android redirect URL 분리
```

local-only 모드는 유지한다. 로그인하지 않아도 로컬 기록은 계속 사용할 수 있어야 한다.

## 3. RLS

모든 syncable table에 `user_id uuid references auth.users(id)`를 둔다.

대상 테이블:

```text
public.devices
public.notes
public.tasks
public.workout_records
public.meal_records
public.weight_records
```

정책:

```sql
select: auth.uid() = user_id
insert: auth.uid() = user_id
update: auth.uid() = user_id and with check auth.uid() = user_id
delete: 앱에서는 hard delete를 사용하지 않으므로 금지하거나 명시 정책으로 제한
```

Supabase anon/publishable key는 클라이언트에 있을 수 있지만 service_role key는 절대 클라이언트에 넣지 않는다.

## 4. localStorage 보안 경계

localStorage 암호화는 “완전 보안”으로 과장하지 않는다. 같은 클라이언트에 key가 있으면 공격자를 완전히 막지 못한다.

추후 전환 경계:

```text
src/lib/auth/authSession.ts
src/lib/auth/authStorage.ts
StorageAdapter
SecureStorageAdapter 후보
```

## 5. X 공유 MVP

직접 X API post가 아니라 clipboard/share intent를 우선한다.

```text
Copy report
Copy image
Share to X compose/share intent
```

텍스트 포맷:

```text
오늘의 생산성
완료한 일 수
운동 기록
칼로리/단백질 요약
#YeonsiksNote #오운완 #LifeCommandCenter
```

이미지 포맷:

```text
Command Center card를 PNG로 캡처
web/Android/Tauri 각각 fallback
```

실패 fallback은 텍스트 복사만이라도 성공해야 한다.
