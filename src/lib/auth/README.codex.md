# Auth Library — Codex Notes

이 폴더는 Supabase Auth session layer를 위한 신규 경계다.

제안 파일:

```text
authSession.ts
authStorage.ts
```

해야 할 일:

```text
local-only mode와 authenticated sync mode를 분리
manual User ID UI deprecated path 제공
web/Tauri/Android redirect URL 차이를 처리할 수 있게 설계
```

주의:

```text
localStorage 암호화를 완전 보안처럼 표현하지 않는다.
service_role key를 클라이언트에 넣지 않는다.
```
