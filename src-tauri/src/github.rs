use serde::{de::DeserializeOwned, Deserialize, Serialize};
use std::{
    collections::{HashMap, HashSet},
    env, fmt, fs,
    future::Future,
    path::{Path, PathBuf},
    pin::Pin,
    sync::Mutex,
    time::{Duration, SystemTime, UNIX_EPOCH},
};
use tauri::Manager;

const GITHUB_API_BASE_URL: &str = "https://api.github.com";
const GITHUB_OAUTH_BASE_URL: &str = "https://github.com";
const GITHUB_API_VERSION: &str = "2022-11-28";
const REQUEST_TIMEOUT_SECONDS: u64 = 20;
const DEFAULT_DEVICE_POLL_INTERVAL_SECONDS: u64 = 5;
const CREDENTIAL_SERVICE: &str = "com.yeonsik.note.github";
const CREDENTIAL_USERNAME: &str = "github-device-flow";
const GITHUB_CONFIG_FILE_NAME: &str = "github-config.json";
const GITHUB_COMMIT_HISTORY_PAGE_SIZE: u32 = 100;

#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub enum GitHubErrorCode {
    NotConfigured,
    NotConnected,
    CredentialStore,
    DeviceFlow,
    Unauthorized,
    Forbidden,
    NotFound,
    RateLimited,
    Timeout,
    Network,
    InvalidInput,
    InvalidResponse,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct GitHubError {
    pub code: GitHubErrorCode,
    pub message: String,
    pub status: Option<u16>,
    pub retry_after_seconds: Option<u64>,
}

impl GitHubError {
    fn new(code: GitHubErrorCode, message: impl Into<String>) -> Self {
        Self {
            code,
            message: message.into(),
            status: None,
            retry_after_seconds: None,
        }
    }

    fn with_status(mut self, status: u16) -> Self {
        self.status = Some(status);
        self
    }

    fn with_retry_after(mut self, retry_after_seconds: Option<u64>) -> Self {
        self.retry_after_seconds = retry_after_seconds;
        self
    }
}

impl fmt::Display for GitHubError {
    fn fmt(&self, formatter: &mut fmt::Formatter<'_>) -> fmt::Result {
        formatter.write_str(&self.message)
    }
}

impl std::error::Error for GitHubError {}

#[derive(Clone, PartialEq, Eq)]
struct SecretString(String);

impl SecretString {
    fn new(value: impl Into<String>) -> Self {
        Self(value.into())
    }

    fn expose(&self) -> &str {
        &self.0
    }
}

impl fmt::Debug for SecretString {
    fn fmt(&self, formatter: &mut fmt::Formatter<'_>) -> fmt::Result {
        formatter.write_str("[REDACTED]")
    }
}

impl fmt::Display for SecretString {
    fn fmt(&self, formatter: &mut fmt::Formatter<'_>) -> fmt::Result {
        formatter.write_str("[REDACTED]")
    }
}

#[derive(Clone)]
struct StoredGitHubCredential {
    access_token: String,
    refresh_token: Option<String>,
    expires_at_unix: Option<i64>,
}

#[derive(Serialize, Deserialize)]
struct StoredGitHubCredentialWire {
    access_token: String,
    refresh_token: Option<String>,
    expires_at_unix: Option<i64>,
}

struct GitHubCredentialStore;

trait GitHubCredentialBackend: Send + Sync {
    fn get(&self) -> Result<Option<StoredGitHubCredential>, GitHubError>;
    fn set(&self, credential: &StoredGitHubCredential) -> Result<(), GitHubError>;
}

impl GitHubCredentialStore {
    fn native() -> Self {
        Self
    }

    fn entry(&self) -> Result<keyring::Entry, GitHubError> {
        keyring::Entry::new(CREDENTIAL_SERVICE, CREDENTIAL_USERNAME).map_err(|_| {
            GitHubError::new(
                GitHubErrorCode::CredentialStore,
                "OS Credential Store를 사용할 수 없습니다.",
            )
        })
    }

    fn get(&self) -> Result<Option<StoredGitHubCredential>, GitHubError> {
        let value = match self.entry()?.get_password() {
            Ok(value) => value,
            Err(keyring::Error::NoEntry) => return Ok(None),
            Err(_) => {
                return Err(GitHubError::new(
                    GitHubErrorCode::CredentialStore,
                    "OS Credential Store에서 GitHub 연결 정보를 읽지 못했습니다.",
                ))
            }
        };

        let stored = serde_json::from_str::<StoredGitHubCredentialWire>(&value).map_err(|_| {
            GitHubError::new(
                GitHubErrorCode::CredentialStore,
                "OS Credential Store의 GitHub 연결 정보가 올바르지 않습니다.",
            )
        })?;

        if stored.access_token.trim().is_empty() {
            return Ok(None);
        }

        Ok(Some(StoredGitHubCredential {
            access_token: stored.access_token,
            refresh_token: stored.refresh_token,
            expires_at_unix: stored.expires_at_unix,
        }))
    }

    fn set(&self, credential: &StoredGitHubCredential) -> Result<(), GitHubError> {
        let wire = StoredGitHubCredentialWire {
            access_token: credential.access_token.clone(),
            refresh_token: credential.refresh_token.clone(),
            expires_at_unix: credential.expires_at_unix,
        };
        let value = serde_json::to_string(&wire).map_err(|_| {
            GitHubError::new(
                GitHubErrorCode::CredentialStore,
                "GitHub 연결 정보를 저장할 수 없습니다.",
            )
        })?;

        self.entry()?.set_password(&value).map_err(|_| {
            GitHubError::new(
                GitHubErrorCode::CredentialStore,
                "OS Credential Store에 GitHub 연결 정보를 저장하지 못했습니다.",
            )
        })
    }

    fn delete(&self) -> Result<(), GitHubError> {
        match self.entry()?.delete_credential() {
            Ok(()) | Err(keyring::Error::NoEntry) => Ok(()),
            Err(_) => Err(GitHubError::new(
                GitHubErrorCode::CredentialStore,
                "OS Credential Store에서 GitHub 연결 정보를 삭제하지 못했습니다.",
            )),
        }
    }
}

impl GitHubCredentialBackend for GitHubCredentialStore {
    fn get(&self) -> Result<Option<StoredGitHubCredential>, GitHubError> {
        GitHubCredentialStore::get(self)
    }

    fn set(&self, credential: &StoredGitHubCredential) -> Result<(), GitHubError> {
        GitHubCredentialStore::set(self, credential)
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum GitHubHttpMethod {
    Get,
    Post,
}

#[derive(Clone)]
pub struct GitHubHttpRequest {
    pub method: GitHubHttpMethod,
    pub base_url: String,
    pub path: String,
    pub query: Vec<(String, String)>,
    bearer_token: Option<SecretString>,
}

impl fmt::Debug for GitHubHttpRequest {
    fn fmt(&self, formatter: &mut fmt::Formatter<'_>) -> fmt::Result {
        formatter
            .debug_struct("GitHubHttpRequest")
            .field("method", &self.method)
            .field("base_url", &self.base_url)
            .field("path", &self.path)
            .field(
                "query",
                &self
                    .query
                    .iter()
                    .map(|(key, _)| (key, "[REDACTED]"))
                    .collect::<Vec<_>>(),
            )
            .field("bearer_token", &self.bearer_token)
            .finish()
    }
}

#[derive(Clone, PartialEq, Eq)]
pub struct GitHubHttpResponse {
    pub status: u16,
    pub headers: HashMap<String, String>,
    pub body: String,
}

impl fmt::Debug for GitHubHttpResponse {
    fn fmt(&self, formatter: &mut fmt::Formatter<'_>) -> fmt::Result {
        formatter
            .debug_struct("GitHubHttpResponse")
            .field("status", &self.status)
            .field("headers", &self.headers)
            .field("body", &"[REDACTED]")
            .finish()
    }
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub enum GitHubTransportErrorKind {
    Timeout,
    Connection,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct GitHubTransportError {
    pub kind: GitHubTransportErrorKind,
}

pub trait GitHubTransport: Send + Sync {
    fn send<'a>(
        &'a self,
        request: GitHubHttpRequest,
    ) -> Pin<Box<dyn Future<Output = Result<GitHubHttpResponse, GitHubTransportError>> + Send + 'a>>;
}

#[derive(Clone)]
struct ReqwestTransport {
    client: reqwest::Client,
}

impl ReqwestTransport {
    fn new() -> Result<Self, GitHubError> {
        let client = reqwest::Client::builder()
            .timeout(Duration::from_secs(REQUEST_TIMEOUT_SECONDS))
            .user_agent("PersonalOS-GitHub-ReadOnly/1.0")
            .build()
            .map_err(|_| {
                GitHubError::new(
                    GitHubErrorCode::Network,
                    "GitHub API 클라이언트를 초기화하지 못했습니다.",
                )
            })?;
        Ok(Self { client })
    }
}

impl GitHubTransport for ReqwestTransport {
    fn send<'a>(
        &'a self,
        request: GitHubHttpRequest,
    ) -> Pin<Box<dyn Future<Output = Result<GitHubHttpResponse, GitHubTransportError>> + Send + 'a>>
    {
        Box::pin(async move {
            let method = match request.method {
                GitHubHttpMethod::Get => reqwest::Method::GET,
                GitHubHttpMethod::Post => reqwest::Method::POST,
            };
            let url = format!("{}{}", request.base_url, request.path);
            let mut builder = self
                .client
                .request(method, url)
                .query(&request.query)
                .header(reqwest::header::ACCEPT, "application/json")
                .header("X-GitHub-Api-Version", GITHUB_API_VERSION);

            if let Some(token) = request.bearer_token {
                builder = builder.bearer_auth(token.expose());
            }
            let response = builder.send().await.map_err(|error| {
                if error.is_timeout() {
                    GitHubTransportError {
                        kind: GitHubTransportErrorKind::Timeout,
                    }
                } else {
                    GitHubTransportError {
                        kind: GitHubTransportErrorKind::Connection,
                    }
                }
            })?;
            let status = response.status().as_u16();
            let headers = response
                .headers()
                .iter()
                .filter_map(|(name, value)| {
                    value
                        .to_str()
                        .ok()
                        .map(|value| (name.as_str().to_ascii_lowercase(), value.to_string()))
                })
                .collect();
            let body = response.text().await.map_err(|error| {
                if error.is_timeout() {
                    GitHubTransportError {
                        kind: GitHubTransportErrorKind::Timeout,
                    }
                } else {
                    GitHubTransportError {
                        kind: GitHubTransportErrorKind::Connection,
                    }
                }
            })?;

            Ok(GitHubHttpResponse {
                status,
                headers,
                body,
            })
        })
    }
}

pub struct GitHubApi<T> {
    transport: T,
}

impl<T> GitHubApi<T>
where
    T: GitHubTransport,
{
    pub fn new(transport: T) -> Self {
        Self { transport }
    }

    async fn send(&self, request: GitHubHttpRequest) -> Result<GitHubHttpResponse, GitHubError> {
        match self.transport.send(request).await {
            Ok(response) if (200..300).contains(&response.status) => Ok(response),
            Ok(response) => Err(map_http_status(&response)),
            Err(error) => Err(match error.kind {
                GitHubTransportErrorKind::Timeout => GitHubError::new(
                    GitHubErrorCode::Timeout,
                    "GitHub API 요청 시간이 초과되었습니다.",
                ),
                GitHubTransportErrorKind::Connection => GitHubError::new(
                    GitHubErrorCode::Network,
                    "GitHub API에 연결하지 못했습니다.",
                ),
            }),
        }
    }

    async fn get_json<U: DeserializeOwned>(
        &self,
        token: &SecretString,
        path: impl Into<String>,
        query: Vec<(String, String)>,
    ) -> Result<U, GitHubError> {
        self.get_json_with_status(token, path, query)
            .await
            .map(|(value, _)| value)
    }

    async fn get_json_with_status<U: DeserializeOwned>(
        &self,
        token: &SecretString,
        path: impl Into<String>,
        query: Vec<(String, String)>,
    ) -> Result<(U, u16), GitHubError> {
        let (value, response) = self.get_json_with_response(token, path, query).await?;
        Ok((value, response.status))
    }

    async fn get_json_with_response<U: DeserializeOwned>(
        &self,
        token: &SecretString,
        path: impl Into<String>,
        query: Vec<(String, String)>,
    ) -> Result<(U, GitHubHttpResponse), GitHubError> {
        let path = path.into();
        let response = self
            .send(GitHubHttpRequest {
                method: GitHubHttpMethod::Get,
                base_url: GITHUB_API_BASE_URL.to_string(),
                path: path.clone(),
                query,
                bearer_token: Some(token.clone()),
            })
            .await?;
        serde_json::from_str::<U>(&response.body)
            .map(|value| (value, response))
            .map_err(|error| {
                GitHubError::new(
                    GitHubErrorCode::InvalidResponse,
                    format!("GitHub API 응답 형식이 올바르지 않습니다: {path} ({error})"),
                )
            })
    }

    async fn post_oauth(
        &self,
        query: Vec<(String, String)>,
    ) -> Result<GitHubHttpResponse, GitHubError> {
        let response = self
            .transport
            .send(GitHubHttpRequest {
                method: GitHubHttpMethod::Post,
                base_url: GITHUB_OAUTH_BASE_URL.to_string(),
                path: "/login/oauth/access_token".to_string(),
                query,
                bearer_token: None,
            })
            .await
            .map_err(|error| match error.kind {
                GitHubTransportErrorKind::Timeout => GitHubError::new(
                    GitHubErrorCode::Timeout,
                    "GitHub Device Flow 요청 시간이 초과되었습니다.",
                ),
                GitHubTransportErrorKind::Connection => GitHubError::new(
                    GitHubErrorCode::Network,
                    "GitHub Device Flow에 연결하지 못했습니다.",
                ),
            })?;

        if !(200..300).contains(&response.status) {
            return Err(map_http_status(&response));
        }
        Ok(response)
    }

    async fn post_device_code(&self, client_id: &str) -> Result<DeviceCodeWire, GitHubError> {
        let response = self
            .transport
            .send(GitHubHttpRequest {
                method: GitHubHttpMethod::Post,
                base_url: GITHUB_OAUTH_BASE_URL.to_string(),
                path: "/login/device/code".to_string(),
                query: vec![("client_id".to_string(), client_id.to_string())],
                bearer_token: None,
            })
            .await
            .map_err(|error| match error.kind {
                GitHubTransportErrorKind::Timeout => GitHubError::new(
                    GitHubErrorCode::Timeout,
                    "GitHub Device Flow 시작 시간이 초과되었습니다.",
                ),
                GitHubTransportErrorKind::Connection => GitHubError::new(
                    GitHubErrorCode::Network,
                    "GitHub Device Flow를 시작하지 못했습니다.",
                ),
            })?;
        if !(200..300).contains(&response.status) {
            return Err(map_http_status(&response));
        }
        serde_json::from_str::<DeviceCodeWire>(&response.body).map_err(|_| {
            GitHubError::new(
                GitHubErrorCode::InvalidResponse,
                "GitHub Device Flow 시작 응답 형식이 올바르지 않습니다.",
            )
        })
    }

    async fn start_device_flow(&self, client_id: &str) -> Result<DeviceFlowStart, GitHubError> {
        if client_id.trim().is_empty() {
            return Err(GitHubError::new(
                GitHubErrorCode::NotConfigured,
                "GitHub Client ID가 설정되지 않았습니다.",
            ));
        }
        let response = self.post_device_code(client_id).await?;
        Ok(DeviceFlowStart {
            user_code: response.user_code,
            verification_uri: response.verification_uri,
            expires_in_seconds: response.expires_in,
            interval_seconds: response
                .interval
                .unwrap_or(DEFAULT_DEVICE_POLL_INTERVAL_SECONDS),
            device_code: SecretString::new(response.device_code),
        })
    }

    async fn poll_token(
        &self,
        client_id: &str,
        device_code: &SecretString,
    ) -> Result<DeviceTokenPoll, GitHubError> {
        let response = self
            .post_oauth(vec![
                ("client_id".to_string(), client_id.to_string()),
                ("device_code".to_string(), device_code.expose().to_string()),
                (
                    "grant_type".to_string(),
                    "urn:ietf:params:oauth:grant-type:device_code".to_string(),
                ),
            ])
            .await?;
        let token = serde_json::from_str::<TokenResponseWire>(&response.body).map_err(|_| {
            GitHubError::new(
                GitHubErrorCode::InvalidResponse,
                "GitHub Device Flow token 응답 형식이 올바르지 않습니다.",
            )
        })?;
        parse_token_response(token)
    }

    async fn refresh_token(
        &self,
        client_id: &str,
        refresh_token: &SecretString,
    ) -> Result<StoredGitHubCredential, GitHubError> {
        let response = self
            .post_oauth(vec![
                ("client_id".to_string(), client_id.to_string()),
                ("grant_type".to_string(), "refresh_token".to_string()),
                (
                    "refresh_token".to_string(),
                    refresh_token.expose().to_string(),
                ),
            ])
            .await?;
        let token = serde_json::from_str::<TokenResponseWire>(&response.body).map_err(|_| {
            GitHubError::new(
                GitHubErrorCode::InvalidResponse,
                "GitHub token 갱신 응답 형식이 올바르지 않습니다.",
            )
        })?;
        match parse_token_response(token) {
            Ok(DeviceTokenPoll::Authorized(credential)) => Ok(credential),
            Ok(DeviceTokenPoll::Pending { .. })
            | Ok(DeviceTokenPoll::Denied)
            | Ok(DeviceTokenPoll::Expired)
            | Err(_) => Err(GitHubError::new(
                GitHubErrorCode::Unauthorized,
                "GitHub 연결 token을 갱신하지 못했습니다. 다시 연결하세요.",
            )),
        }
    }

    async fn user(&self, token: &SecretString) -> Result<GitHubUser, GitHubError> {
        let wire: UserWire = self.get_json(token, "/user", Vec::new()).await?;
        Ok(GitHubUser {
            login: wire.login,
            name: wire.name,
        })
    }

    async fn list_repositories_with_diagnostic(
        &self,
        token: &SecretString,
        search: Option<&str>,
    ) -> GitHubRepositoryListResult {
        let mut diagnostic = GitHubRepositoryListDiagnostic::initial();
        let (_, user_status): (UserWire, u16) =
            match self.get_json_with_status(token, "/user", Vec::new()).await {
                Ok(result) => result,
                Err(error) => {
                    diagnostic.user_status = error.status;
                    return GitHubRepositoryListResult::api_error(diagnostic, error);
                }
            };
        diagnostic.user_status = Some(user_status);
        diagnostic.user_count = 1;

        let (installations, installation_statuses) =
            match self.list_installations_with_status(token).await {
                Ok(result) => result,
                Err(error) => {
                    if let Some(status) = error.status {
                        diagnostic.installation_statuses.push(status);
                    }
                    return GitHubRepositoryListResult::api_error(diagnostic, error);
                }
            };
        diagnostic.installation_statuses = installation_statuses;
        diagnostic.installation_count = installations.len();
        diagnostic.installed_app_slugs = installations
            .iter()
            .filter_map(|installation| installation.app_slug.clone())
            .collect();
        diagnostic.installed_app_slugs.sort();
        diagnostic.installed_app_slugs.dedup();

        if installations.is_empty() {
            diagnostic.state = GitHubRepositoryListState::NoInstallations;
            return GitHubRepositoryListResult {
                repositories: Vec::new(),
                diagnostic,
            };
        }

        let mut accessible_repositories = Vec::new();
        let mut seen = HashSet::new();

        for installation in installations {
            let mut installation_diagnostic = GitHubInstallationRepositoryDiagnostic {
                app_slug: installation.app_slug.clone(),
                statuses: Vec::new(),
                repository_count: 0,
            };
            let mut page = 1u32;
            loop {
                let (response, status): (InstallationRepositoriesWire, u16) = match self
                    .get_json_with_status(
                        token,
                        format!("/user/installations/{}/repositories", installation.id),
                        vec![
                            ("per_page".to_string(), "100".to_string()),
                            ("page".to_string(), page.to_string()),
                        ],
                    )
                    .await
                {
                    Ok(result) => result,
                    Err(error) => {
                        if let Some(status) = error.status {
                            installation_diagnostic.statuses.push(status);
                        }
                        diagnostic
                            .installation_repositories
                            .push(installation_diagnostic);
                        return GitHubRepositoryListResult::api_error(diagnostic, error);
                    }
                };
                installation_diagnostic.statuses.push(status);
                let page_count = response.repositories.len();
                installation_diagnostic.repository_count += page_count;
                for repository in response.repositories {
                    if !seen.insert(repository.id) {
                        continue;
                    }
                    let option = match repository.into_repository() {
                        Ok(option) => option,
                        Err(error) => {
                            diagnostic
                                .installation_repositories
                                .push(installation_diagnostic);
                            return GitHubRepositoryListResult::api_error(diagnostic, error);
                        }
                    };
                    accessible_repositories.push(option);
                }
                if page_count < 100 {
                    break;
                }
                page += 1;
            }
            diagnostic
                .installation_repositories
                .push(installation_diagnostic);
        }

        let mut repositories = accessible_repositories
            .iter()
            .filter(|repository| matches_repository_search(repository, search))
            .cloned()
            .collect::<Vec<_>>();
        repositories.sort_by(|first, second| first.full_name.cmp(&second.full_name));
        diagnostic.accessible_repository_count = accessible_repositories.len();
        diagnostic.matching_repository_count = repositories.len();
        diagnostic.state = if accessible_repositories.is_empty() {
            GitHubRepositoryListState::NoRepositories
        } else if repositories.is_empty() {
            GitHubRepositoryListState::NoSearchResults
        } else {
            GitHubRepositoryListState::Ready
        };
        GitHubRepositoryListResult {
            repositories,
            diagnostic,
        }
    }

    async fn list_installations_with_status(
        &self,
        token: &SecretString,
    ) -> Result<(Vec<InstallationWire>, Vec<u16>), GitHubError> {
        let mut installations = Vec::new();
        let mut statuses = Vec::new();
        let mut page = 1u32;
        loop {
            let (response, status): (InstallationsWire, u16) = self
                .get_json_with_status(
                    token,
                    "/user/installations",
                    vec![
                        ("per_page".to_string(), "100".to_string()),
                        ("page".to_string(), page.to_string()),
                    ],
                )
                .await?;
            statuses.push(status);
            let page_count = response.installations.len();
            installations.extend(response.installations);
            if page_count < 100 {
                return Ok((installations, statuses));
            }
            page += 1;
        }
    }

    async fn list_branches(
        &self,
        token: &SecretString,
        owner: &str,
        repository: &str,
    ) -> Result<Vec<GitHubBranch>, GitHubError> {
        let owner = validate_repository_segment(owner, "owner")?;
        let repository = validate_repository_segment(repository, "repository")?;
        let wires: Vec<BranchWire> = self
            .get_json(
                token,
                format!("/repos/{owner}/{repository}/branches"),
                vec![("per_page".to_string(), "100".to_string())],
            )
            .await?;
        let mut branches = wires
            .into_iter()
            .map(|branch| GitHubBranch {
                name: branch.name,
                protected: branch.protected,
            })
            .collect::<Vec<_>>();
        branches.sort_by(|first, second| first.name.cmp(&second.name));
        Ok(branches)
    }

    async fn read_repository(
        &self,
        token: &SecretString,
        owner: &str,
        repository: &str,
        branch: &str,
    ) -> Result<GitHubRepositoryReadModel, GitHubError> {
        let owner = validate_repository_segment(owner, "owner")?;
        let repository = validate_repository_segment(repository, "repository")?;
        let branch = branch.trim();
        if branch.is_empty() || branch.len() > 250 {
            return Err(GitHubError::new(
                GitHubErrorCode::InvalidInput,
                "추적할 GitHub branch를 입력하세요.",
            ));
        }

        let repository_wire: RepositoryWire = self
            .get_json(token, format!("/repos/{owner}/{repository}"), Vec::new())
            .await?;
        let commits: Vec<CommitWire> = self
            .get_json(
                token,
                format!("/repos/{owner}/{repository}/commits"),
                vec![
                    ("sha".to_string(), branch.to_string()),
                    ("per_page".to_string(), "1".to_string()),
                ],
            )
            .await?;
        let pull_requests: Vec<PullRequestWire> = self
            .get_json(
                token,
                format!("/repos/{owner}/{repository}/pulls"),
                vec![
                    ("state".to_string(), "open".to_string()),
                    ("sort".to_string(), "updated".to_string()),
                    ("direction".to_string(), "desc".to_string()),
                    ("per_page".to_string(), "10".to_string()),
                ],
            )
            .await?;

        let recent_commits = commits
            .iter()
            .map(CommitWire::into_commit)
            .collect::<Vec<_>>();
        let remote_head = recent_commits.first().cloned();
        Ok(GitHubRepositoryReadModel {
            repository: repository_wire.into_repository()?,
            tracked_branch: branch.to_string(),
            remote_head,
            recent_commits,
            open_pull_requests: pull_requests
                .into_iter()
                .map(PullRequestWire::into_pull_request)
                .collect(),
            queried_at: now_iso(),
        })
    }

    async fn read_commit_history(
        &self,
        token: &SecretString,
        owner: &str,
        repository: &str,
        branch: &str,
        page: u32,
    ) -> Result<GitHubCommitHistoryPage, GitHubError> {
        let owner = validate_repository_segment(owner, "owner")?;
        let repository = validate_repository_segment(repository, "repository")?;
        let branch = branch.trim();
        if branch.is_empty() || branch.len() > 250 {
            return Err(GitHubError::new(
                GitHubErrorCode::InvalidInput,
                "조회할 GitHub branch를 입력하세요.",
            ));
        }
        if page == 0 {
            return Err(GitHubError::new(
                GitHubErrorCode::InvalidInput,
                "GitHub commit history page는 1 이상이어야 합니다.",
            ));
        }

        let (commits, response): (Vec<CommitWire>, GitHubHttpResponse) = self
            .get_json_with_response(
                token,
                format!("/repos/{owner}/{repository}/commits"),
                vec![
                    ("sha".to_string(), branch.to_string()),
                    (
                        "per_page".to_string(),
                        GITHUB_COMMIT_HISTORY_PAGE_SIZE.to_string(),
                    ),
                    ("page".to_string(), page.to_string()),
                ],
            )
            .await?;
        let commit_count = commits.len();
        let has_next_page = response
            .headers
            .get("link")
            .map(|link| link.split(',').any(|entry| entry.contains("rel=\"next\"")))
            .unwrap_or(commit_count as u32 == GITHUB_COMMIT_HISTORY_PAGE_SIZE);

        Ok(GitHubCommitHistoryPage {
            commits: commits
                .iter()
                .map(CommitWire::into_commit)
                .collect::<Vec<_>>(),
            page,
            per_page: GITHUB_COMMIT_HISTORY_PAGE_SIZE,
            has_next_page,
        })
    }
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct GitHubConnectionStatus {
    pub configured: bool,
    pub connected: bool,
    pub account_login: Option<String>,
    pub account_name: Option<String>,
    pub management_url: Option<String>,
    pub error: Option<String>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DeviceFlowStart {
    pub user_code: String,
    pub verification_uri: String,
    pub expires_in_seconds: u64,
    pub interval_seconds: u64,
    #[serde(skip)]
    device_code: SecretString,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DeviceFlowPollResult {
    pub status: String,
    pub retry_after_seconds: Option<u64>,
    pub connection: Option<GitHubConnectionStatus>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct GitHubRepository {
    pub id: String,
    pub owner: String,
    pub name: String,
    pub full_name: String,
    pub html_url: String,
    pub default_branch: String,
    pub private: bool,
    pub description: Option<String>,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
#[serde(rename_all = "kebab-case")]
pub enum GitHubRepositoryListState {
    Ready,
    NoInstallations,
    NoRepositories,
    NoSearchResults,
    ApiError,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct GitHubRepositoryApiError {
    pub code: GitHubErrorCode,
    pub message: String,
    pub status: Option<u16>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct GitHubInstallationRepositoryDiagnostic {
    pub app_slug: Option<String>,
    pub statuses: Vec<u16>,
    pub repository_count: usize,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct GitHubRepositoryListDiagnostic {
    pub state: GitHubRepositoryListState,
    pub user_status: Option<u16>,
    pub user_count: usize,
    pub installation_statuses: Vec<u16>,
    pub installation_count: usize,
    pub installation_repositories: Vec<GitHubInstallationRepositoryDiagnostic>,
    pub accessible_repository_count: usize,
    pub matching_repository_count: usize,
    pub installed_app_slugs: Vec<String>,
    pub error: Option<GitHubRepositoryApiError>,
}

impl GitHubRepositoryListDiagnostic {
    fn initial() -> Self {
        Self {
            state: GitHubRepositoryListState::Ready,
            user_status: None,
            user_count: 0,
            installation_statuses: Vec::new(),
            installation_count: 0,
            installation_repositories: Vec::new(),
            accessible_repository_count: 0,
            matching_repository_count: 0,
            installed_app_slugs: Vec::new(),
            error: None,
        }
    }
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct GitHubRepositoryListResult {
    pub repositories: Vec<GitHubRepository>,
    pub diagnostic: GitHubRepositoryListDiagnostic,
}

impl GitHubRepositoryListResult {
    fn api_error(mut diagnostic: GitHubRepositoryListDiagnostic, error: GitHubError) -> Self {
        diagnostic.state = GitHubRepositoryListState::ApiError;
        diagnostic.error = Some(GitHubRepositoryApiError {
            code: error.code,
            message: error.message,
            status: error.status,
        });
        Self {
            repositories: Vec::new(),
            diagnostic,
        }
    }
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct GitHubBranch {
    pub name: String,
    pub protected: bool,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct GitHubRemoteCommit {
    pub sha: String,
    pub message: String,
    pub committed_at: Option<String>,
    pub html_url: String,
    pub author: Option<String>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct GitHubRemotePullRequest {
    pub number: u64,
    pub title: String,
    pub html_url: String,
    pub state: String,
    pub updated_at: Option<String>,
    pub draft: bool,
    pub head_branch: Option<String>,
    pub base_branch: Option<String>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct GitHubRepositoryReadModel {
    pub repository: GitHubRepository,
    pub tracked_branch: String,
    pub remote_head: Option<GitHubRemoteCommit>,
    /// Retained for the existing frontend contract; repository observation now
    /// requests only the single HEAD commit and full history is paged separately.
    pub recent_commits: Vec<GitHubRemoteCommit>,
    pub open_pull_requests: Vec<GitHubRemotePullRequest>,
    pub queried_at: String,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct GitHubCommitHistoryPage {
    pub commits: Vec<GitHubRemoteCommit>,
    pub page: u32,
    pub per_page: u32,
    pub has_next_page: bool,
}

#[derive(Clone)]
struct PendingDeviceFlow {
    client_id: String,
    device_code: SecretString,
    expires_at_unix: i64,
    interval_seconds: u64,
}

#[derive(Default)]
pub struct GitHubState {
    pending_device_flow: Mutex<Option<PendingDeviceFlow>>,
}

#[derive(Debug, Clone)]
struct GitHubConfig {
    client_id: String,
    app_slug: Option<String>,
}

#[derive(Debug, Clone, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
struct GitHubConfigFile {
    client_id: String,
    app_slug: Option<String>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct GitHubConfigStatus {
    pub client_id: String,
    pub configured: bool,
    pub app_slug: Option<String>,
    pub source: String,
}

#[derive(Deserialize)]
struct DeviceCodeWire {
    device_code: String,
    user_code: String,
    verification_uri: String,
    expires_in: u64,
    interval: Option<u64>,
}

#[derive(Deserialize)]
struct TokenResponseWire {
    access_token: Option<String>,
    refresh_token: Option<String>,
    expires_in: Option<u64>,
    error: Option<String>,
}

enum DeviceTokenPoll {
    Pending { retry_after_seconds: u64 },
    Authorized(StoredGitHubCredential),
    Denied,
    Expired,
}

#[derive(Debug, Clone)]
struct GitHubUser {
    login: String,
    name: Option<String>,
}

#[derive(Debug, Deserialize)]
struct UserWire {
    login: String,
    name: Option<String>,
}

#[derive(Debug, Deserialize)]
struct InstallationsWire {
    installations: Vec<InstallationWire>,
}

#[derive(Debug, Deserialize)]
struct InstallationWire {
    id: u64,
    #[serde(default)]
    app_slug: Option<String>,
}

#[derive(Debug, Deserialize)]
struct InstallationRepositoriesWire {
    repositories: Vec<RepositoryWire>,
}

#[derive(Debug, Deserialize)]
struct RepositoryWire {
    id: u64,
    name: String,
    full_name: String,
    html_url: String,
    default_branch: Option<String>,
    private: bool,
    description: Option<String>,
    owner: OwnerWire,
}

#[derive(Debug, Deserialize)]
struct OwnerWire {
    login: String,
}

impl RepositoryWire {
    fn into_repository(self) -> Result<GitHubRepository, GitHubError> {
        let default_branch = self.default_branch.ok_or_else(|| {
            GitHubError::new(
                GitHubErrorCode::InvalidResponse,
                "GitHub Repository의 default branch가 없습니다.",
            )
        })?;
        Ok(GitHubRepository {
            id: self.id.to_string(),
            owner: self.owner.login,
            name: self.name,
            full_name: self.full_name,
            html_url: self.html_url,
            default_branch,
            private: self.private,
            description: self.description,
        })
    }
}

#[derive(Debug, Deserialize)]
struct BranchWire {
    name: String,
    protected: bool,
}

#[derive(Debug, Deserialize)]
struct CommitWire {
    sha: String,
    html_url: String,
    commit: CommitDetailWire,
}

#[derive(Debug, Deserialize)]
struct CommitDetailWire {
    message: String,
    author: Option<GitPersonWire>,
    committer: Option<GitPersonWire>,
}

#[derive(Debug, Deserialize)]
struct GitPersonWire {
    name: Option<String>,
    date: Option<String>,
}

impl CommitWire {
    fn into_commit(&self) -> GitHubRemoteCommit {
        let committed_at = self
            .commit
            .committer
            .as_ref()
            .and_then(|person| person.date.clone())
            .or_else(|| {
                self.commit
                    .author
                    .as_ref()
                    .and_then(|person| person.date.clone())
            });
        let author = self
            .commit
            .author
            .as_ref()
            .and_then(|person| person.name.clone());
        GitHubRemoteCommit {
            sha: self.sha.clone(),
            message: self.commit.message.clone(),
            committed_at,
            html_url: self.html_url.clone(),
            author,
        }
    }
}

#[derive(Debug, Deserialize)]
struct PullRequestWire {
    number: u64,
    title: String,
    html_url: String,
    state: String,
    updated_at: Option<String>,
    draft: Option<bool>,
    head: Option<PullRefWire>,
    base: Option<PullRefWire>,
}

#[derive(Debug, Deserialize)]
struct PullRefWire {
    #[serde(rename = "ref")]
    r#ref: Option<String>,
}

impl PullRequestWire {
    fn into_pull_request(self) -> GitHubRemotePullRequest {
        GitHubRemotePullRequest {
            number: self.number,
            title: self.title,
            html_url: self.html_url,
            state: self.state,
            updated_at: self.updated_at,
            draft: self.draft.unwrap_or(false),
            head_branch: self.head.and_then(|value| value.r#ref),
            base_branch: self.base.and_then(|value| value.r#ref),
        }
    }
}

fn parse_token_response(token: TokenResponseWire) -> Result<DeviceTokenPoll, GitHubError> {
    if let Some(access_token) = token.access_token.filter(|value| !value.trim().is_empty()) {
        return Ok(DeviceTokenPoll::Authorized(StoredGitHubCredential {
            access_token,
            refresh_token: token.refresh_token,
            expires_at_unix: token
                .expires_in
                .map(|seconds| unix_now().saturating_add(seconds as i64)),
        }));
    }

    match token.error.as_deref() {
        Some("authorization_pending") => Ok(DeviceTokenPoll::Pending {
            retry_after_seconds: DEFAULT_DEVICE_POLL_INTERVAL_SECONDS,
        }),
        Some("slow_down") => Ok(DeviceTokenPoll::Pending {
            retry_after_seconds: DEFAULT_DEVICE_POLL_INTERVAL_SECONDS + 5,
        }),
        Some("expired_token") => Ok(DeviceTokenPoll::Expired),
        Some("access_denied") => Ok(DeviceTokenPoll::Denied),
        Some(_) => Err(GitHubError::new(
            GitHubErrorCode::DeviceFlow,
            "GitHub Device Flow 인증을 완료하지 못했습니다.",
        )),
        None => Err(GitHubError::new(
            GitHubErrorCode::InvalidResponse,
            "GitHub token 응답에 access token이 없습니다.",
        )),
    }
}

fn map_http_status(response: &GitHubHttpResponse) -> GitHubError {
    let retry_after = response
        .headers
        .get("retry-after")
        .and_then(|value| value.parse::<u64>().ok());
    let (code, message) = match response.status {
        401 => (
            GitHubErrorCode::Unauthorized,
            "GitHub 인증이 만료되었거나 권한이 없습니다.",
        ),
        403 => (
            if retry_after.is_some() {
                GitHubErrorCode::RateLimited
            } else {
                GitHubErrorCode::Forbidden
            },
            "GitHub Repository를 조회할 권한이 없습니다.",
        ),
        404 => (
            GitHubErrorCode::NotFound,
            "GitHub Repository 또는 리소스를 찾을 수 없습니다.",
        ),
        429 => (
            GitHubErrorCode::RateLimited,
            "GitHub API 요청 한도에 도달했습니다.",
        ),
        _ => (GitHubErrorCode::Network, "GitHub API 요청이 실패했습니다."),
    };
    GitHubError::new(code, message)
        .with_status(response.status)
        .with_retry_after(retry_after)
}

fn matches_repository_search(repository: &GitHubRepository, search: Option<&str>) -> bool {
    let Some(search) = search.map(str::trim).filter(|value| !value.is_empty()) else {
        return true;
    };
    let needle = search.to_ascii_lowercase();
    repository.full_name.to_ascii_lowercase().contains(&needle)
        || repository.name.to_ascii_lowercase().contains(&needle)
        || repository.owner.to_ascii_lowercase().contains(&needle)
}

fn validate_repository_segment(value: &str, label: &str) -> Result<String, GitHubError> {
    let normalized = value.trim();
    if normalized.is_empty()
        || normalized.len() > 100
        || !normalized
            .chars()
            .all(|character| character.is_ascii_alphanumeric() || "-_.".contains(character))
    {
        return Err(GitHubError::new(
            GitHubErrorCode::InvalidInput,
            format!("GitHub {label} 값이 올바르지 않습니다."),
        ));
    }
    Ok(normalized.to_string())
}

fn unix_now() -> i64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|duration| duration.as_secs() as i64)
        .unwrap_or_default()
}

fn now_iso() -> String {
    let seconds = unix_now();
    let days = seconds.div_euclid(86_400);
    let day_seconds = seconds.rem_euclid(86_400);
    let hour = day_seconds / 3_600;
    let minute = (day_seconds % 3_600) / 60;
    let second = day_seconds % 60;
    let z = days + 719_468;
    let era = (if z >= 0 { z } else { z - 146_096 }).div_euclid(146_097);
    let doe = z - era * 146_097;
    let yoe = (doe - doe / 1_460 + doe / 36_524 - doe / 146_096).div_euclid(365);
    let year = yoe + era * 400;
    let doy = doe - (365 * yoe + yoe / 4 - yoe / 100);
    let month_part = (5 * doy + 2).div_euclid(153);
    let day = doy - (153 * month_part + 2).div_euclid(5) + 1;
    let month = month_part + if month_part < 10 { 3 } else { -9 };
    let year = year + if month <= 2 { 1 } else { 0 };
    format!("{year:04}-{month:02}-{day:02}T{hour:02}:{minute:02}:{second:02}.000Z")
}

fn parse_env(contents: &str) -> HashMap<String, String> {
    let mut values = HashMap::new();
    for raw_line in contents.lines() {
        let line = raw_line.trim();
        if line.is_empty() || line.starts_with('#') {
            continue;
        }
        let line = line.strip_prefix("export ").unwrap_or(line).trim();
        if let Some((key, value)) = line.split_once('=') {
            let key = key.trim();
            if !key.is_empty() {
                let value = value.trim();
                let value = if value.len() >= 2
                    && ((value.starts_with('"') && value.ends_with('"'))
                        || (value.starts_with('\'') && value.ends_with('\'')))
                {
                    value[1..value.len() - 1].to_string()
                } else {
                    value.to_string()
                };
                values.insert(key.to_string(), value);
            }
        }
    }
    values
}

fn github_env_candidates(app: &tauri::AppHandle) -> Vec<PathBuf> {
    let mut candidates = Vec::new();
    if let Ok(explicit_path) = env::var("YEONSIK_NOTE_ENV") {
        let path = PathBuf::from(explicit_path.trim());
        if !path.as_os_str().is_empty() {
            candidates.push(path);
        }
    }
    if let Ok(config_dir) = app.path().app_config_dir() {
        candidates.push(config_dir.join(".env"));
        candidates.push(config_dir.join("yeonsik-note.env"));
    }
    if let Ok(exe_path) = env::current_exe() {
        if let Some(exe_dir) = exe_path.parent() {
            candidates.push(exe_dir.join(".env"));
            candidates.push(exe_dir.join("yeonsik-note.env"));
        }
    }
    if let Ok(current_dir) = env::current_dir() {
        candidates.push(current_dir.join(".env"));
    }
    candidates
}

fn github_config_path(app: &tauri::AppHandle) -> Result<PathBuf, GitHubError> {
    app.path()
        .app_config_dir()
        .map(|config_dir| config_dir.join(GITHUB_CONFIG_FILE_NAME))
        .map_err(|error| {
            GitHubError::new(
                GitHubErrorCode::InvalidResponse,
                format!("GitHub 설정 저장 위치를 확인하지 못했습니다: {error}"),
            )
        })
}

fn normalize_github_config(
    client_id: String,
    app_slug: Option<String>,
) -> Result<GitHubConfig, GitHubError> {
    let client_id = client_id.trim().to_string();
    if client_id.is_empty() {
        return Err(GitHubError::new(
            GitHubErrorCode::InvalidInput,
            "GitHub Client ID를 입력하세요.",
        ));
    }

    Ok(GitHubConfig {
        client_id,
        app_slug: app_slug
            .map(|value| value.trim().to_string())
            .filter(|value| !value.is_empty()),
    })
}

fn read_github_config_file(path: &Path) -> Result<Option<GitHubConfig>, GitHubError> {
    if !path.is_file() {
        return Ok(None);
    }

    let contents = fs::read_to_string(path).map_err(|error| {
        GitHubError::new(
            GitHubErrorCode::InvalidResponse,
            format!("GitHub 설정을 읽지 못했습니다: {error}"),
        )
    })?;
    let stored = serde_json::from_str::<GitHubConfigFile>(&contents).map_err(|error| {
        GitHubError::new(
            GitHubErrorCode::InvalidResponse,
            format!("GitHub 설정 형식이 올바르지 않습니다: {error}"),
        )
    })?;

    normalize_github_config(stored.client_id, stored.app_slug).map(Some)
}

fn write_github_config_file(path: &Path, config: &GitHubConfig) -> Result<(), GitHubError> {
    let parent = path.parent().ok_or_else(|| {
        GitHubError::new(
            GitHubErrorCode::InvalidResponse,
            "GitHub 설정 저장 위치에 상위 디렉터리가 없습니다.",
        )
    })?;
    fs::create_dir_all(parent).map_err(|error| {
        GitHubError::new(
            GitHubErrorCode::InvalidResponse,
            format!("GitHub 설정 디렉터리를 만들지 못했습니다: {error}"),
        )
    })?;

    let stored = GitHubConfigFile {
        client_id: config.client_id.clone(),
        app_slug: config.app_slug.clone(),
    };
    let contents = serde_json::to_string_pretty(&stored).map_err(|error| {
        GitHubError::new(
            GitHubErrorCode::InvalidResponse,
            format!("GitHub 설정을 직렬화하지 못했습니다: {error}"),
        )
    })?;
    fs::write(path, contents).map_err(|error| {
        GitHubError::new(
            GitHubErrorCode::InvalidResponse,
            format!("GitHub 설정을 저장하지 못했습니다: {error}"),
        )
    })
}

fn delete_github_config_file(path: &Path) -> Result<(), GitHubError> {
    match fs::remove_file(path) {
        Ok(()) => Ok(()),
        Err(error) if error.kind() == std::io::ErrorKind::NotFound => Ok(()),
        Err(error) => Err(GitHubError::new(
            GitHubErrorCode::InvalidResponse,
            format!("GitHub 설정을 삭제하지 못했습니다: {error}"),
        )),
    }
}

fn non_empty_config_value(values: &HashMap<String, String>, keys: &[&str]) -> String {
    keys.iter()
        .find_map(|key| values.get(*key))
        .map(|value| value.trim().to_string())
        .filter(|value| !value.is_empty())
        .unwrap_or_default()
}

fn resolve_github_config_values(
    local: Option<GitHubConfig>,
    environment: &HashMap<String, String>,
    file: &HashMap<String, String>,
) -> (GitHubConfig, String) {
    if let Some(config) = local {
        return (config, "local-settings".to_string());
    }

    let environment_client_id = non_empty_config_value(environment, &["GITHUB_CLIENT_ID"]);
    let has_environment_client_id = !environment_client_id.is_empty();
    let file_client_id =
        non_empty_config_value(file, &["GITHUB_CLIENT_ID", "VITE_GITHUB_CLIENT_ID"]);
    let environment_app_slug = non_empty_config_value(environment, &["GITHUB_APP_SLUG"]);
    let client_id = if !environment_client_id.is_empty() {
        environment_client_id
    } else {
        file_client_id.clone()
    };
    let app_slug = if !environment_app_slug.is_empty() {
        Some(environment_app_slug)
    } else {
        let value = non_empty_config_value(file, &["GITHUB_APP_SLUG", "VITE_GITHUB_APP_SLUG"]);
        (!value.is_empty()).then_some(value)
    };
    let source = if !client_id.is_empty() {
        if has_environment_client_id {
            "env"
        } else {
            "file"
        }
    } else {
        "none"
    };

    (
        GitHubConfig {
            client_id,
            app_slug,
        },
        source.to_string(),
    )
}

fn github_environment_values() -> HashMap<String, String> {
    ["GITHUB_CLIENT_ID", "GITHUB_APP_SLUG"]
        .into_iter()
        .filter_map(|key| env::var(key).ok().map(|value| (key.to_string(), value)))
        .collect()
}

fn github_file_environment_values(app: &tauri::AppHandle) -> HashMap<String, String> {
    for candidate in github_env_candidates(app) {
        if candidate.is_file() {
            if let Ok(contents) = fs::read_to_string(candidate) {
                return parse_env(&contents);
            }
        }
    }
    HashMap::new()
}

fn resolve_github_config(app: &tauri::AppHandle) -> Result<(GitHubConfig, String), GitHubError> {
    let local = read_github_config_file(&github_config_path(app)?)?;
    Ok(resolve_github_config_values(
        local,
        &github_environment_values(),
        &github_file_environment_values(app),
    ))
}

fn load_github_config(app: &tauri::AppHandle) -> GitHubConfig {
    resolve_github_config(app)
        .map(|(config, _)| config)
        .unwrap_or_else(|_| GitHubConfig {
            client_id: String::new(),
            app_slug: None,
        })
}

fn current_github_config_status(app: &tauri::AppHandle) -> Result<GitHubConfigStatus, GitHubError> {
    let (config, source) = resolve_github_config(app)?;
    Ok(GitHubConfigStatus {
        configured: !config.client_id.is_empty(),
        client_id: config.client_id,
        app_slug: config.app_slug,
        source,
    })
}

fn management_url(config: &GitHubConfig) -> Option<String> {
    config
        .app_slug
        .as_ref()
        .map(|slug| format!("https://github.com/apps/{slug}/installations/new"))
}

fn disconnected_status(config: &GitHubConfig) -> GitHubConnectionStatus {
    GitHubConnectionStatus {
        configured: !config.client_id.is_empty(),
        connected: false,
        account_login: None,
        account_name: None,
        management_url: management_url(config),
        error: if config.client_id.is_empty() {
            Some("GitHub Client ID가 설정되지 않았습니다.".to_string())
        } else {
            None
        },
    }
}

async fn access_token<T, B>(
    api: &GitHubApi<T>,
    store: &B,
    config: &GitHubConfig,
) -> Result<SecretString, GitHubError>
where
    T: GitHubTransport,
    B: GitHubCredentialBackend,
{
    if config.client_id.is_empty() {
        return Err(GitHubError::new(
            GitHubErrorCode::NotConfigured,
            "GitHub Client ID가 설정되지 않았습니다.",
        ));
    }
    let credential = store.get()?.ok_or_else(|| {
        GitHubError::new(
            GitHubErrorCode::NotConnected,
            "GitHub 계정을 먼저 연결하세요.",
        )
    })?;
    if credential
        .expires_at_unix
        .map(|expires_at| expires_at > unix_now() + 60)
        .unwrap_or(true)
    {
        return Ok(SecretString::new(credential.access_token));
    }
    let Some(refresh_token) = credential.refresh_token else {
        return Err(GitHubError::new(
            GitHubErrorCode::Unauthorized,
            "GitHub 연결이 만료되었습니다. 다시 연결하세요.",
        ));
    };
    let refreshed = api
        .refresh_token(config.client_id.as_str(), &SecretString::new(refresh_token))
        .await?;
    let access_token = refreshed.access_token.clone();
    store.set(&refreshed)?;
    Ok(SecretString::new(access_token))
}

fn connection_error_message(error: &GitHubError) -> String {
    if error.status == Some(401) || matches!(&error.code, GitHubErrorCode::Unauthorized) {
        return "GitHub 인증이 만료되었거나 취소되었습니다. 다시 연결하세요.".to_string();
    }

    if matches!(
        &error.code,
        GitHubErrorCode::Network | GitHubErrorCode::Timeout
    ) {
        return format!(
            "GitHub 연결 상태를 확인하지 못했습니다. 네트워크를 확인하세요. ({})",
            error.message
        );
    }

    error.message.clone()
}

async fn verified_connection_status<T, B>(
    api: &GitHubApi<T>,
    store: &B,
    config: &GitHubConfig,
) -> GitHubConnectionStatus
where
    T: GitHubTransport,
    B: GitHubCredentialBackend,
{
    let mut status = disconnected_status(config);
    if !status.configured {
        return status;
    }

    match access_token(api, store, config).await {
        Ok(token) => match api.user(&token).await {
            Ok(user) => {
                status.connected = true;
                status.account_login = Some(user.login);
                status.account_name = user.name;
            }
            Err(error) => {
                status.error = Some(connection_error_message(&error));
            }
        },
        Err(error) => {
            status.error = Some(connection_error_message(&error));
        }
    }

    status
}

async fn native_api() -> Result<GitHubApi<ReqwestTransport>, GitHubError> {
    Ok(GitHubApi::new(ReqwestTransport::new()?))
}

#[tauri::command(rename_all = "camelCase")]
pub fn github_config_status(app: tauri::AppHandle) -> Result<GitHubConfigStatus, GitHubError> {
    current_github_config_status(&app)
}

#[tauri::command(rename_all = "camelCase")]
pub fn github_save_config(
    app: tauri::AppHandle,
    client_id: String,
    app_slug: Option<String>,
) -> Result<GitHubConfigStatus, GitHubError> {
    let config = normalize_github_config(client_id, app_slug)?;
    let path = github_config_path(&app)?;
    write_github_config_file(&path, &config)?;
    current_github_config_status(&app)
}

#[tauri::command(rename_all = "camelCase")]
pub fn github_delete_config(app: tauri::AppHandle) -> Result<GitHubConfigStatus, GitHubError> {
    delete_github_config_file(&github_config_path(&app)?)?;
    current_github_config_status(&app)
}

#[tauri::command(rename_all = "camelCase")]
pub async fn github_connection_status(
    app: tauri::AppHandle,
) -> Result<GitHubConnectionStatus, GitHubError> {
    let config = load_github_config(&app);
    let mut status = disconnected_status(&config);
    if !status.configured {
        return Ok(status);
    }
    let store = GitHubCredentialStore::native();
    let api = match native_api().await {
        Ok(api) => api,
        Err(error) => {
            status.error = Some(connection_error_message(&error));
            return Ok(status);
        }
    };
    Ok(verified_connection_status(&api, &store, &config).await)
}

#[tauri::command(rename_all = "camelCase")]
pub async fn github_device_flow_start(
    app: tauri::AppHandle,
    state: tauri::State<'_, GitHubState>,
) -> Result<DeviceFlowStart, GitHubError> {
    let config = load_github_config(&app);
    let api = native_api().await?;
    let flow = api.start_device_flow(&config.client_id).await?;
    let pending = PendingDeviceFlow {
        client_id: config.client_id,
        device_code: flow.device_code.clone(),
        expires_at_unix: unix_now().saturating_add(flow.expires_in_seconds as i64),
        interval_seconds: flow.interval_seconds,
    };
    state
        .pending_device_flow
        .lock()
        .map_err(|_| {
            GitHubError::new(
                GitHubErrorCode::DeviceFlow,
                "Device Flow 상태를 저장하지 못했습니다.",
            )
        })?
        .replace(pending);
    Ok(flow)
}

#[tauri::command(rename_all = "camelCase")]
pub async fn github_device_flow_poll(
    app: tauri::AppHandle,
    state: tauri::State<'_, GitHubState>,
) -> Result<DeviceFlowPollResult, GitHubError> {
    let pending = state
        .pending_device_flow
        .lock()
        .map_err(|_| {
            GitHubError::new(
                GitHubErrorCode::DeviceFlow,
                "Device Flow 상태를 읽지 못했습니다.",
            )
        })?
        .clone()
        .ok_or_else(|| {
            GitHubError::new(
                GitHubErrorCode::DeviceFlow,
                "진행 중인 Device Flow가 없습니다.",
            )
        })?;
    if pending.expires_at_unix <= unix_now() {
        state
            .pending_device_flow
            .lock()
            .map_err(|_| {
                GitHubError::new(
                    GitHubErrorCode::DeviceFlow,
                    "Device Flow 상태를 갱신하지 못했습니다.",
                )
            })?
            .take();
        return Ok(DeviceFlowPollResult {
            status: "expired".to_string(),
            retry_after_seconds: None,
            connection: None,
        });
    }
    let api = native_api().await?;
    match api
        .poll_token(&pending.client_id, &pending.device_code)
        .await?
    {
        DeviceTokenPoll::Pending {
            retry_after_seconds,
        } => Ok(DeviceFlowPollResult {
            status: "pending".to_string(),
            retry_after_seconds: Some(retry_after_seconds.max(pending.interval_seconds)),
            connection: None,
        }),
        DeviceTokenPoll::Denied => {
            state
                .pending_device_flow
                .lock()
                .map_err(|_| {
                    GitHubError::new(
                        GitHubErrorCode::DeviceFlow,
                        "Device Flow 상태를 갱신하지 못했습니다.",
                    )
                })?
                .take();
            Ok(DeviceFlowPollResult {
                status: "denied".to_string(),
                retry_after_seconds: None,
                connection: None,
            })
        }
        DeviceTokenPoll::Expired => {
            state
                .pending_device_flow
                .lock()
                .map_err(|_| {
                    GitHubError::new(
                        GitHubErrorCode::DeviceFlow,
                        "Device Flow 상태를 갱신하지 못했습니다.",
                    )
                })?
                .take();
            Ok(DeviceFlowPollResult {
                status: "expired".to_string(),
                retry_after_seconds: None,
                connection: None,
            })
        }
        DeviceTokenPoll::Authorized(credential) => {
            let store = GitHubCredentialStore::native();
            store.set(&credential)?;
            state
                .pending_device_flow
                .lock()
                .map_err(|_| {
                    GitHubError::new(
                        GitHubErrorCode::DeviceFlow,
                        "Device Flow 상태를 갱신하지 못했습니다.",
                    )
                })?
                .take();
            let config = load_github_config(&app);
            let status = verified_connection_status(&api, &store, &config).await;
            Ok(DeviceFlowPollResult {
                status: "authorized".to_string(),
                retry_after_seconds: None,
                connection: Some(status),
            })
        }
    }
}

#[tauri::command(rename_all = "camelCase")]
pub fn github_device_flow_cancel(state: tauri::State<'_, GitHubState>) -> Result<(), GitHubError> {
    state
        .pending_device_flow
        .lock()
        .map_err(|_| {
            GitHubError::new(
                GitHubErrorCode::DeviceFlow,
                "Device Flow 상태를 갱신하지 못했습니다.",
            )
        })?
        .take();
    Ok(())
}

#[tauri::command(rename_all = "camelCase")]
pub fn github_disconnect(
    app: tauri::AppHandle,
    state: tauri::State<'_, GitHubState>,
) -> Result<GitHubConnectionStatus, GitHubError> {
    GitHubCredentialStore::native().delete()?;
    state
        .pending_device_flow
        .lock()
        .map_err(|_| {
            GitHubError::new(
                GitHubErrorCode::DeviceFlow,
                "Device Flow 상태를 갱신하지 못했습니다.",
            )
        })?
        .take();
    Ok(disconnected_status(&load_github_config(&app)))
}

#[tauri::command(rename_all = "camelCase")]
pub async fn github_list_repositories(
    app: tauri::AppHandle,
    search: Option<String>,
) -> Result<GitHubRepositoryListResult, GitHubError> {
    let config = load_github_config(&app);
    let diagnostic = GitHubRepositoryListDiagnostic::initial();
    let api = match native_api().await {
        Ok(api) => api,
        Err(error) => return Ok(GitHubRepositoryListResult::api_error(diagnostic, error)),
    };
    let store = GitHubCredentialStore::native();
    let token = match access_token(&api, &store, &config).await {
        Ok(token) => token,
        Err(error) => return Ok(GitHubRepositoryListResult::api_error(diagnostic, error)),
    };
    Ok(api
        .list_repositories_with_diagnostic(&token, search.as_deref())
        .await)
}

#[tauri::command(rename_all = "camelCase")]
pub async fn github_list_branches(
    app: tauri::AppHandle,
    owner: String,
    repository: String,
) -> Result<Vec<GitHubBranch>, GitHubError> {
    let config = load_github_config(&app);
    let api = native_api().await?;
    let store = GitHubCredentialStore::native();
    let token = access_token(&api, &store, &config).await?;
    api.list_branches(&token, &owner, &repository).await
}

#[tauri::command(rename_all = "camelCase")]
pub async fn github_read_repository(
    app: tauri::AppHandle,
    owner: String,
    repository: String,
    branch: String,
) -> Result<GitHubRepositoryReadModel, GitHubError> {
    let config = load_github_config(&app);
    let api = native_api().await?;
    let store = GitHubCredentialStore::native();
    let token = access_token(&api, &store, &config).await?;
    api.read_repository(&token, &owner, &repository, &branch)
        .await
}

#[tauri::command(rename_all = "camelCase")]
pub async fn github_read_commit_history(
    app: tauri::AppHandle,
    owner: String,
    repository: String,
    branch: String,
    page: u32,
) -> Result<GitHubCommitHistoryPage, GitHubError> {
    let config = load_github_config(&app);
    let api = native_api().await?;
    let store = GitHubCredentialStore::native();
    let token = access_token(&api, &store, &config).await?;
    api.read_commit_history(&token, &owner, &repository, &branch, page)
        .await
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::sync::{Arc, Mutex};

    #[derive(Clone, Default)]
    struct FakeTransport {
        responses: Arc<Mutex<Vec<GitHubHttpResponse>>>,
        requests: Arc<Mutex<Vec<GitHubHttpRequest>>>,
    }

    impl FakeTransport {
        fn with_responses(responses: Vec<GitHubHttpResponse>) -> Self {
            Self {
                responses: Arc::new(Mutex::new(responses)),
                requests: Arc::new(Mutex::new(Vec::new())),
            }
        }
    }

    #[derive(Default)]
    struct MemoryCredentialStore {
        credential: Mutex<Option<StoredGitHubCredential>>,
    }

    impl MemoryCredentialStore {
        fn with_credential(credential: StoredGitHubCredential) -> Self {
            Self {
                credential: Mutex::new(Some(credential)),
            }
        }
    }

    impl GitHubCredentialBackend for MemoryCredentialStore {
        fn get(&self) -> Result<Option<StoredGitHubCredential>, GitHubError> {
            Ok(self.credential.lock().expect("credential lock").clone())
        }

        fn set(&self, credential: &StoredGitHubCredential) -> Result<(), GitHubError> {
            *self.credential.lock().expect("credential lock") = Some(credential.clone());
            Ok(())
        }
    }

    impl GitHubTransport for FakeTransport {
        fn send<'a>(
            &'a self,
            request: GitHubHttpRequest,
        ) -> Pin<
            Box<dyn Future<Output = Result<GitHubHttpResponse, GitHubTransportError>> + Send + 'a>,
        > {
            Box::pin(async move {
                self.requests.lock().expect("request lock").push(request);
                self.responses
                    .lock()
                    .expect("response lock")
                    .pop()
                    .ok_or(GitHubTransportError {
                        kind: GitHubTransportErrorKind::Connection,
                    })
            })
        }
    }

    fn response(body: &str) -> GitHubHttpResponse {
        response_with_status(200, body)
    }

    fn response_with_status(status: u16, body: &str) -> GitHubHttpResponse {
        GitHubHttpResponse {
            status,
            headers: HashMap::new(),
            body: body.to_string(),
        }
    }

    fn configured_github() -> GitHubConfig {
        GitHubConfig {
            client_id: "public-client-id".to_string(),
            app_slug: None,
        }
    }

    #[test]
    fn github_config_resolution_prefers_local_settings_then_environment_then_file() {
        let mut environment = HashMap::new();
        environment.insert("GITHUB_CLIENT_ID".to_string(), "env-client-id".to_string());
        environment.insert("GITHUB_APP_SLUG".to_string(), "env-app".to_string());
        let mut file = HashMap::new();
        file.insert("GITHUB_CLIENT_ID".to_string(), "file-client-id".to_string());
        file.insert("GITHUB_APP_SLUG".to_string(), "file-app".to_string());

        let (local_config, local_source) = resolve_github_config_values(
            Some(GitHubConfig {
                client_id: "local-client-id".to_string(),
                app_slug: Some("local-app".to_string()),
            }),
            &environment,
            &file,
        );
        assert_eq!(local_config.client_id, "local-client-id");
        assert_eq!(local_config.app_slug.as_deref(), Some("local-app"));
        assert_eq!(local_source, "local-settings");

        let (environment_config, environment_source) =
            resolve_github_config_values(None, &environment, &file);
        assert_eq!(environment_config.client_id, "env-client-id");
        assert_eq!(environment_config.app_slug.as_deref(), Some("env-app"));
        assert_eq!(environment_source, "env");

        let (file_config, file_source) = resolve_github_config_values(None, &HashMap::new(), &file);
        assert_eq!(file_config.client_id, "file-client-id");
        assert_eq!(file_config.app_slug.as_deref(), Some("file-app"));
        assert_eq!(file_source, "file");

        let (empty_config, empty_source) =
            resolve_github_config_values(None, &HashMap::new(), &HashMap::new());
        assert!(empty_config.client_id.is_empty());
        assert_eq!(empty_config.app_slug, None);
        assert_eq!(empty_source, "none");
    }

    #[test]
    fn github_config_file_save_load_delete_round_trip() {
        let directory = std::env::temp_dir().join(format!(
            "personalos-github-config-test-{}",
            std::process::id()
        ));
        let path = directory.join(GITHUB_CONFIG_FILE_NAME);
        let config = GitHubConfig {
            client_id: "public-client-id".to_string(),
            app_slug: Some("personal-os".to_string()),
        };

        write_github_config_file(&path, &config).expect("config should save");
        let serialized = fs::read_to_string(&path).expect("config should be readable");
        assert!(serialized.contains("clientId"));
        assert!(serialized.contains("appSlug"));
        assert!(!serialized.contains("access_token"));
        assert!(!serialized.contains("refresh_token"));

        let loaded = read_github_config_file(&path)
            .expect("config should load")
            .expect("config should exist");
        assert_eq!(loaded.client_id, config.client_id);
        assert_eq!(loaded.app_slug, config.app_slug);

        delete_github_config_file(&path).expect("config should delete");
        assert!(read_github_config_file(&path)
            .expect("missing config should be readable")
            .is_none());
        let _ = fs::remove_dir_all(directory);
    }

    fn valid_credential() -> StoredGitHubCredential {
        StoredGitHubCredential {
            access_token: "access-secret".to_string(),
            refresh_token: None,
            expires_at_unix: Some(unix_now() + 3_600),
        }
    }

    #[tokio::test]
    async fn connection_status_is_connected_only_after_user_validation() {
        let store = MemoryCredentialStore::with_credential(valid_credential());
        let transport = FakeTransport::with_responses(vec![response(
            r#"{"login":"octocat","name":"Octo Cat"}"#,
        )]);
        let api = GitHubApi::new(transport);

        let status = verified_connection_status(&api, &store, &configured_github()).await;

        assert!(status.connected);
        assert_eq!(status.account_login.as_deref(), Some("octocat"));
        assert_eq!(status.account_name.as_deref(), Some("Octo Cat"));
        assert!(status.error.is_none());
    }

    #[tokio::test]
    async fn expired_or_revoked_credentials_are_disconnected_with_reconnect_error() {
        let expired_store = MemoryCredentialStore::with_credential(StoredGitHubCredential {
            expires_at_unix: Some(0),
            ..valid_credential()
        });
        let expired_api = GitHubApi::new(FakeTransport::default());
        let expired_status =
            verified_connection_status(&expired_api, &expired_store, &configured_github()).await;

        assert!(!expired_status.connected);
        assert!(expired_status
            .error
            .as_deref()
            .is_some_and(|message| message.contains("다시 연결")));

        let revoked_store = MemoryCredentialStore::with_credential(valid_credential());
        let revoked_api =
            GitHubApi::new(FakeTransport::with_responses(vec![response_with_status(
                401,
                r#"{"message":"Bad credentials"}"#,
            )]));
        let revoked_status =
            verified_connection_status(&revoked_api, &revoked_store, &configured_github()).await;

        assert!(!revoked_status.connected);
        assert!(revoked_status
            .error
            .as_deref()
            .is_some_and(|message| message.contains("다시 연결")));
    }

    #[tokio::test]
    async fn refresh_failure_is_disconnected_without_deleting_credential() {
        let store = MemoryCredentialStore::with_credential(StoredGitHubCredential {
            refresh_token: Some("refresh-secret".to_string()),
            expires_at_unix: Some(0),
            ..valid_credential()
        });
        let api = GitHubApi::new(FakeTransport::with_responses(vec![response_with_status(
            401,
            r#"{"message":"Bad credentials"}"#,
        )]));

        let status = verified_connection_status(&api, &store, &configured_github()).await;

        assert!(!status.connected);
        assert!(status
            .error
            .as_deref()
            .is_some_and(|message| message.contains("다시 연결")));
        assert!(store.credential.lock().expect("credential lock").is_some());
    }

    #[tokio::test]
    async fn network_failure_keeps_credential_and_reports_connection_error() {
        let store = MemoryCredentialStore::with_credential(valid_credential());
        let api = GitHubApi::new(FakeTransport::default());

        let status = verified_connection_status(&api, &store, &configured_github()).await;

        assert!(!status.connected);
        assert!(status
            .error
            .as_deref()
            .is_some_and(|message| message.contains("네트워크")));
        assert!(store.credential.lock().expect("credential lock").is_some());
    }

    #[tokio::test]
    async fn repository_list_diagnostic_records_successful_api_steps_and_counts() {
        let transport = FakeTransport::with_responses(vec![
            response(
                r#"{"repositories":[{"id":42,"name":"Always_Memo","full_name":"octo/Always_Memo","html_url":"https://github.com/octo/Always_Memo","default_branch":"main","private":true,"description":null,"owner":{"login":"octo"}}]}"#,
            ),
            response(r#"{"installations":[{"id":7,"app_slug":"personal-os"}]}"#),
            response(r#"{"login":"octo","name":"Octo Cat"}"#),
        ]);
        let request_log = transport.requests.clone();
        let api = GitHubApi::new(transport);

        let result = api
            .list_repositories_with_diagnostic(&SecretString::new("access-secret"), Some("always"))
            .await;

        assert_eq!(result.diagnostic.state, GitHubRepositoryListState::Ready);
        assert_eq!(result.diagnostic.user_status, Some(200));
        assert_eq!(result.diagnostic.user_count, 1);
        assert_eq!(result.diagnostic.installation_statuses, vec![200]);
        assert_eq!(result.diagnostic.installation_count, 1);
        assert_eq!(result.diagnostic.installed_app_slugs, vec!["personal-os"]);
        assert_eq!(result.diagnostic.accessible_repository_count, 1);
        assert_eq!(result.diagnostic.matching_repository_count, 1);
        assert_eq!(
            result.diagnostic.installation_repositories[0].statuses,
            vec![200]
        );
        assert_eq!(
            result.diagnostic.installation_repositories[0].repository_count,
            1
        );
        assert_eq!(result.repositories[0].full_name, "octo/Always_Memo");
        assert!(result.diagnostic.error.is_none());

        let requests = request_log.lock().expect("request log");
        assert_eq!(requests[0].path, "/user");
        assert_eq!(requests[1].path, "/user/installations");
        assert_eq!(requests[2].path, "/user/installations/7/repositories");
        assert!(!format!("{:?}", requests[2]).contains("access-secret"));
    }

    #[tokio::test]
    async fn repository_list_diagnostic_distinguishes_no_installations() {
        let api = GitHubApi::new(FakeTransport::with_responses(vec![
            response(r#"{"installations":[]}"#),
            response(r#"{"login":"octo","name":null}"#),
        ]));

        let result = api
            .list_repositories_with_diagnostic(&SecretString::new("access-secret"), None)
            .await;

        assert_eq!(
            result.diagnostic.state,
            GitHubRepositoryListState::NoInstallations
        );
        assert_eq!(result.diagnostic.user_status, Some(200));
        assert_eq!(result.diagnostic.installation_statuses, vec![200]);
        assert_eq!(result.diagnostic.installation_count, 0);
        assert!(result.repositories.is_empty());
    }

    #[tokio::test]
    async fn repository_list_diagnostic_preserves_repository_api_error_status() {
        let api = GitHubApi::new(FakeTransport::with_responses(vec![
            response_with_status(404, r#"{"message":"Not Found"}"#),
            response(r#"{"installations":[{"id":7,"app_slug":"personal-os"}]}"#),
            response(r#"{"login":"octo","name":null}"#),
        ]));

        let result = api
            .list_repositories_with_diagnostic(&SecretString::new("access-secret"), None)
            .await;

        assert_eq!(result.diagnostic.state, GitHubRepositoryListState::ApiError);
        assert_eq!(result.diagnostic.user_status, Some(200));
        assert_eq!(result.diagnostic.installation_statuses, vec![200]);
        assert_eq!(result.diagnostic.installation_count, 1);
        assert_eq!(
            result.diagnostic.installation_repositories[0].statuses,
            vec![404]
        );
        assert_eq!(
            result
                .diagnostic
                .error
                .as_ref()
                .and_then(|error| error.status),
            Some(404)
        );
        assert!(result.repositories.is_empty());
    }

    #[tokio::test]
    async fn repository_read_model_uses_get_only_and_keeps_remote_observations_outside_project_state(
    ) {
        let transport = FakeTransport::with_responses(vec![
            response(r#"[{"number":1,"title":"PR","html_url":"https://github.com/a/r/pull/1","state":"open","updated_at":"2026-09-12T00:00:00Z","draft":false,"head":{"ref":"feature"},"base":{"ref":"main"}}]"#),
            response("[{\"sha\":\"head\",\"html_url\":\"https://github.com/a/r/commit/head\",\"commit\":{\"message\":\"HEAD message\",\"author\":{\"name\":\"dev\",\"date\":\"2026-09-12T00:00:00Z\"},\"committer\":null}}]"),
            response("{\"id\":1,\"name\":\"repo\",\"full_name\":\"a/repo\",\"html_url\":\"https://github.com/a/repo\",\"default_branch\":\"main\",\"private\":false,\"description\":null,\"owner\":{\"login\":\"a\"}}"),
        ]);
        let request_log = transport.requests.clone();
        let api = GitHubApi::new(transport);
        let model = api
            .read_repository(&SecretString::new("access-secret"), "a", "repo", "main")
            .await
            .expect("read model should parse");

        assert_eq!(
            model.remote_head.as_ref().map(|commit| commit.sha.as_str()),
            Some("head")
        );
        assert_eq!(model.open_pull_requests.len(), 1);
        assert!(request_log
            .lock()
            .expect("request log")
            .iter()
            .all(|request| request.method == GitHubHttpMethod::Get));
        let debug = format!("{:?}", request_log.lock().expect("request log")[0]);
        assert!(!debug.contains("access-secret"));
    }

    #[tokio::test]
    async fn commit_history_uses_branch_scoped_pages_of_one_hundred() {
        let first_page = (0..100)
            .map(|index| {
                serde_json::json!({
                    "sha": format!("sha-{index}"),
                    "html_url": format!("https://github.com/a/r/commit/{index}"),
                    "commit": {
                        "message": format!("message {index}"),
                        "author": {"name": "dev", "date": "2026-09-12T00:00:00Z"},
                        "committer": null
                    }
                })
            })
            .collect::<Vec<_>>();
        let first_page_body =
            serde_json::to_string(&first_page).expect("first commit page should serialize");
        let transport = FakeTransport::with_responses(vec![
            response(
                r#"[{"sha":"page-two","html_url":"https://github.com/a/r/commit/page-two","commit":{"message":"page two","author":{"name":"dev","date":"2026-09-11T00:00:00Z"},"committer":null}}]"#,
            ),
            response(&first_page_body),
        ]);
        let request_log = transport.requests.clone();
        let api = GitHubApi::new(transport);

        let first = api
            .read_commit_history(&SecretString::new("access-secret"), "a", "r", "release", 1)
            .await
            .expect("first commit history page should parse");
        let second = api
            .read_commit_history(&SecretString::new("access-secret"), "a", "r", "release", 2)
            .await
            .expect("second commit history page should parse");

        assert_eq!(first.commits.len(), 100);
        assert_eq!(first.page, 1);
        assert_eq!(first.per_page, 100);
        assert!(first.has_next_page);
        assert_eq!(second.commits[0].sha, "page-two");
        assert_eq!(second.page, 2);
        assert!(!second.has_next_page);

        let requests = request_log.lock().expect("request log");
        assert_eq!(
            requests[0].query,
            vec![
                ("sha".to_string(), "release".to_string()),
                ("per_page".to_string(), "100".to_string()),
                ("page".to_string(), "1".to_string()),
            ]
        );
        assert_eq!(
            requests[1].query,
            vec![
                ("sha".to_string(), "release".to_string()),
                ("per_page".to_string(), "100".to_string()),
                ("page".to_string(), "2".to_string()),
            ]
        );
    }

    #[tokio::test]
    async fn device_flow_uses_oauth_post_endpoints_without_logging_secret_parameters() {
        let transport = FakeTransport::with_responses(vec![response(
            r#"{"device_code":"device-secret","user_code":"ABCD-EFGH","verification_uri":"https://github.com/login/device","expires_in":900,"interval":5}"#,
        )]);
        let request_log = transport.requests.clone();
        let api = GitHubApi::new(transport);
        let flow = api
            .start_device_flow("public-client-id")
            .await
            .expect("device flow should start");

        assert_eq!(flow.user_code, "ABCD-EFGH");
        let request = &request_log.lock().expect("request log")[0];
        assert_eq!(request.method, GitHubHttpMethod::Post);
        assert_eq!(request.base_url, GITHUB_OAUTH_BASE_URL);
        assert_eq!(request.path, "/login/device/code");
        assert_eq!(
            request.query,
            vec![("client_id".to_string(), "public-client-id".to_string())]
        );

        let debug = format!("{:?}", request);
        assert!(!debug.contains("public-client-id"));
        assert!(!debug.contains("device-secret"));
        assert_eq!(flow.device_code.expose(), "device-secret");
        let serialized = serde_json::to_string(&flow).expect("device flow should serialize");
        assert!(!serialized.contains("device_code"));
        assert!(!serialized.contains("device-secret"));
    }

    #[test]
    fn request_and_response_debug_redact_oauth_secrets() {
        let request = GitHubHttpRequest {
            method: GitHubHttpMethod::Post,
            base_url: GITHUB_OAUTH_BASE_URL.to_string(),
            path: "/login/oauth/access_token".to_string(),
            query: vec![
                ("device_code".to_string(), "device-secret".to_string()),
                ("refresh_token".to_string(), "refresh-secret".to_string()),
            ],
            bearer_token: Some(SecretString::new("access-secret")),
        };
        let request_debug = format!("{:?}", request);
        assert!(!request_debug.contains("device-secret"));
        assert!(!request_debug.contains("refresh-secret"));
        assert!(!request_debug.contains("access-secret"));

        let response_debug = format!("{:?}", response("access-secret"));
        assert!(!response_debug.contains("access-secret"));
    }

    #[test]
    fn repository_segment_rejects_path_injection() {
        assert!(validate_repository_segment("owner/other", "owner").is_err());
        assert!(validate_repository_segment("repo", "repository").is_ok());
    }

    #[test]
    fn token_response_never_serializes_to_frontend_poll_result() {
        let result = DeviceFlowPollResult {
            status: "authorized".to_string(),
            retry_after_seconds: None,
            connection: Some(GitHubConnectionStatus {
                configured: true,
                connected: true,
                account_login: Some("octocat".to_string()),
                account_name: None,
                management_url: None,
                error: None,
            }),
        };
        let serialized = serde_json::to_string(&result).expect("poll result should serialize");
        assert!(!serialized.contains("access_token"));
        assert!(!serialized.contains("refresh_token"));
    }
}
