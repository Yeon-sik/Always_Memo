# Dev Control GitHub read-only 설정

1. GitHub Developer settings에서 GitHub App을 만들고 General의 Device Flow를 활성화합니다.
2. Repository permissions는 다음 세 가지만 `Read-only`로 설정합니다.
   - Metadata
   - Contents
   - Pull requests
3. App을 설치할 때 `Only select repositories`를 선택하면 Personal OS에서 선택 가능한 Repository 범위를 제한할 수 있습니다.
4. 앱 설정 파일에 공개 값만 입력합니다.

```dotenv
GITHUB_CLIENT_ID=공개_Client_ID
GITHUB_APP_SLUG=설치된_App의_slug
```

Client secret과 private key는 만들거나 배포하지 않습니다. Device Flow의 access/refresh token은 Tauri native 계층에서 OS Credential Store에만 저장되고 React, localStorage, Supabase, 동기화 payload, 로그로 반환하지 않습니다. Personal OS는 Repository metadata, branch, commit, open PR 조회만 수행합니다.
