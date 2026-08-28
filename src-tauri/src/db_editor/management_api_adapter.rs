use super::error::{DbEditorError, DbEditorErrorCode, SecretString};
use super::models::DbEditorProject;
use serde::Deserialize;
use serde_json::Value;
use std::{collections::HashMap, future::Future, pin::Pin, time::Duration};

pub const MANAGEMENT_API_BASE_URL: &str = "https://api.supabase.com";
const REQUEST_TIMEOUT_SECONDS: u64 = 20;

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum HttpMethod {
    Get,
    Post,
}

#[derive(Clone)]
pub struct HttpRequest {
    pub method: HttpMethod,
    pub path: String,
    pub body: Option<Value>,
    pub bearer_token: SecretString,
}

impl std::fmt::Debug for HttpRequest {
    fn fmt(&self, formatter: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        formatter
            .debug_struct("HttpRequest")
            .field("method", &self.method)
            .field("path", &self.path)
            .field("body", &self.body)
            .field("bearer_token", &self.bearer_token)
            .finish()
    }
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct HttpResponse {
    pub status: u16,
    pub headers: HashMap<String, String>,
    pub body: String,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub enum TransportErrorKind {
    Timeout,
    Connection,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct TransportError {
    pub kind: TransportErrorKind,
}

impl TransportError {
    pub fn timeout() -> Self {
        Self {
            kind: TransportErrorKind::Timeout,
        }
    }

    pub fn connection() -> Self {
        Self {
            kind: TransportErrorKind::Connection,
        }
    }
}

pub trait HttpTransport: Send + Sync {
    fn send<'a>(
        &'a self,
        request: HttpRequest,
    ) -> Pin<Box<dyn Future<Output = Result<HttpResponse, TransportError>> + Send + 'a>>;
}

#[derive(Clone)]
pub struct ReqwestTransport {
    client: reqwest::Client,
}

impl ReqwestTransport {
    pub fn new() -> Result<Self, DbEditorError> {
        let client = reqwest::Client::builder()
            .timeout(Duration::from_secs(REQUEST_TIMEOUT_SECONDS))
            .user_agent("PersonalOS-DB-Editor/phase2")
            .build()
            .map_err(|_| {
                DbEditorError::new(
                    DbEditorErrorCode::Network,
                    "Supabase Management API 클라이언트를 초기화하지 못했습니다.",
                )
            })?;

        Ok(Self { client })
    }
}

impl HttpTransport for ReqwestTransport {
    fn send<'a>(
        &'a self,
        request: HttpRequest,
    ) -> Pin<Box<dyn Future<Output = Result<HttpResponse, TransportError>> + Send + 'a>> {
        Box::pin(async move {
            let method = match request.method {
                HttpMethod::Get => reqwest::Method::GET,
                HttpMethod::Post => reqwest::Method::POST,
            };
            let url = format!("{}{}", MANAGEMENT_API_BASE_URL, request.path);

            let mut builder = self
                .client
                .request(method, url)
                .bearer_auth(request.bearer_token.expose())
                .header(reqwest::header::ACCEPT, "application/json");

            if let Some(body) = request.body {
                builder = builder
                    .header(reqwest::header::CONTENT_TYPE, "application/json")
                    .json(&body);
            }

            let response = builder.send().await.map_err(|error| {
                if error.is_timeout() {
                    TransportError::timeout()
                } else {
                    TransportError::connection()
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
                    TransportError::timeout()
                } else {
                    TransportError::connection()
                }
            })?;

            Ok(HttpResponse {
                status,
                headers,
                body,
            })
        })
    }
}

pub struct ManagementApiAdapter<T> {
    transport: T,
    pat: SecretString,
}

impl<T> ManagementApiAdapter<T>
where
    T: HttpTransport,
{
    pub fn new(pat: String, transport: T) -> Self {
        Self {
            transport,
            pat: SecretString::new(pat),
        }
    }

    pub async fn list_projects(&self) -> Result<Vec<DbEditorProject>, DbEditorError> {
        let response = self
            .send(HttpRequest {
                method: HttpMethod::Get,
                path: "/v1/projects".to_string(),
                body: None,
                bearer_token: self.pat.clone(),
            })
            .await?;
        let projects = serde_json::from_str::<Vec<ProjectWire>>(&response.body).map_err(|_| {
            DbEditorError::new(
                DbEditorErrorCode::InvalidResponse,
                "Supabase 프로젝트 응답 형식이 올바르지 않습니다.",
            )
        })?;

        Ok(projects
            .into_iter()
            .filter_map(ProjectWire::into_project)
            .collect())
    }

    pub(crate) async fn run_read_only_query(
        &self,
        project_ref: &str,
        query: &str,
        parameters: Vec<Value>,
    ) -> Result<Vec<Value>, DbEditorError> {
        let project_ref = validate_project_ref(project_ref)?;
        let body = serde_json::json!({
            "query": query,
            "parameters": parameters,
        });
        let response = self
            .send(HttpRequest {
                method: HttpMethod::Post,
                path: format!("/v1/projects/{project_ref}/database/query/read-only"),
                body: Some(body),
                bearer_token: self.pat.clone(),
            })
            .await?;

        extract_query_rows(&response.body)
    }

    pub(crate) async fn run_mutation_query(
        &self,
        project_ref: &str,
        query: &str,
        parameters: Vec<Value>,
    ) -> Result<Vec<Value>, DbEditorError> {
        let project_ref = validate_project_ref(project_ref)?;
        let body = serde_json::json!({
            "query": query,
            "parameters": parameters,
            "read_only": false,
        });
        let response = self
            .send(HttpRequest {
                method: HttpMethod::Post,
                path: format!("/v1/projects/{project_ref}/database/query"),
                body: Some(body),
                bearer_token: self.pat.clone(),
            })
            .await?;

        extract_query_rows(&response.body)
    }

    async fn send(&self, request: HttpRequest) -> Result<HttpResponse, DbEditorError> {
        match self.transport.send(request).await {
            Ok(response) if (200..300).contains(&response.status) => Ok(response),
            Ok(response) => Err(map_http_status(&response)),
            Err(error) => Err(match error.kind {
                TransportErrorKind::Timeout => DbEditorError::new(
                    DbEditorErrorCode::Timeout,
                    "Supabase Management API 요청 시간이 초과되었습니다.",
                ),
                TransportErrorKind::Connection => DbEditorError::new(
                    DbEditorErrorCode::Network,
                    "Supabase Management API에 연결하지 못했습니다.",
                ),
            }),
        }
    }
}

#[derive(Debug, Deserialize)]
struct ProjectWire {
    id: Option<String>,
    #[serde(rename = "ref")]
    project_ref: Option<String>,
    name: Option<String>,
    organization_id: Option<String>,
    organization_slug: Option<String>,
    region: Option<String>,
    status: Option<String>,
}

impl ProjectWire {
    fn into_project(self) -> Option<DbEditorProject> {
        let project_ref = self.project_ref?.trim().to_string();

        if project_ref.is_empty() {
            return None;
        }

        Some(DbEditorProject {
            id: self.id,
            name: self.name.unwrap_or_else(|| project_ref.clone()),
            project_ref,
            organization_id: self.organization_id,
            organization_slug: self.organization_slug,
            region: self.region,
            status: self.status,
        })
    }
}

pub fn validate_project_ref(value: &str) -> Result<String, DbEditorError> {
    let value = value.trim();

    if value.is_empty()
        || value.len() > 64
        || !value
            .bytes()
            .all(|byte| byte.is_ascii_lowercase() || byte.is_ascii_digit() || byte == b'-')
    {
        return Err(DbEditorError::new(
            DbEditorErrorCode::InvalidIdentifier,
            "Supabase 프로젝트 식별자가 올바르지 않습니다.",
        ));
    }

    Ok(value.to_string())
}

fn map_http_status(response: &HttpResponse) -> DbEditorError {
    match response.status {
        401 => DbEditorError::new(
            DbEditorErrorCode::InvalidPat,
            "Supabase PAT가 유효하지 않습니다.",
        )
        .with_status(response.status),
        403 => DbEditorError::new(
            DbEditorErrorCode::PermissionDenied,
            "Supabase Management API 접근 권한이 없습니다.",
        )
        .with_status(response.status),
        429 => DbEditorError::new(
            DbEditorErrorCode::RateLimited,
            "Supabase Management API 요청 한도를 초과했습니다.",
        )
        .with_status(response.status)
        .with_retry_after(parse_retry_after(response)),
        status => DbEditorError::new(
            DbEditorErrorCode::QueryFailed,
            "Supabase Management API 요청에 실패했습니다.",
        )
        .with_status(status),
    }
}

fn parse_retry_after(response: &HttpResponse) -> Option<u64> {
    response
        .headers
        .get("retry-after")
        .and_then(|value| value.trim().parse::<u64>().ok())
}

pub(crate) fn extract_query_rows(body: &str) -> Result<Vec<Value>, DbEditorError> {
    let value = serde_json::from_str::<Value>(body).map_err(|_| {
        DbEditorError::new(
            DbEditorErrorCode::InvalidResponse,
            "Supabase 데이터 응답 형식이 올바르지 않습니다.",
        )
    })?;

    match value {
        Value::Array(rows) => Ok(rows),
        Value::Object(mut object) => {
            for key in ["result", "rows", "data"] {
                if let Some(Value::Array(rows)) = object.remove(key) {
                    return Ok(rows);
                }
            }

            Err(DbEditorError::new(
                DbEditorErrorCode::InvalidResponse,
                "Supabase 데이터 응답에 행 목록이 없습니다.",
            ))
        }
        _ => Err(DbEditorError::new(
            DbEditorErrorCode::InvalidResponse,
            "Supabase 데이터 응답 형식이 올바르지 않습니다.",
        )),
    }
}

#[cfg(test)]
mod tests {
    use super::{
        extract_query_rows, HttpRequest, HttpResponse, HttpTransport, ManagementApiAdapter,
        TransportError,
    };
    use crate::db_editor::error::DbEditorErrorCode;
    use serde_json::json;
    use std::{
        future::Future,
        pin::Pin,
        sync::{Arc, Mutex},
    };

    #[derive(Clone)]
    struct MockTransport {
        response: Arc<Mutex<Result<HttpResponse, TransportError>>>,
        request: Arc<Mutex<Option<HttpRequest>>>,
    }

    impl MockTransport {
        fn response(response: Result<HttpResponse, TransportError>) -> Self {
            Self {
                response: Arc::new(Mutex::new(response)),
                request: Arc::new(Mutex::new(None)),
            }
        }
    }

    impl HttpTransport for MockTransport {
        fn send<'a>(
            &'a self,
            request: HttpRequest,
        ) -> Pin<Box<dyn Future<Output = Result<HttpResponse, TransportError>> + Send + 'a>>
        {
            *self.request.lock().expect("request lock") = Some(request);
            let response = self.response.lock().expect("response lock").clone();
            Box::pin(async move { response })
        }
    }

    #[tokio::test]
    async fn maps_invalid_pat_401_without_returning_response_body() {
        let transport = MockTransport::response(Ok(HttpResponse {
            status: 401,
            headers: Default::default(),
            body: "sbp_super_secret should never be returned".to_string(),
        }));
        let adapter = ManagementApiAdapter::new("sbp_super_secret".to_string(), transport);

        let error = adapter.list_projects().await.expect_err("401 should fail");

        assert_eq!(error.code, DbEditorErrorCode::InvalidPat);
        assert!(!error.message.contains("sbp_super_secret"));
    }

    #[tokio::test]
    async fn maps_permission_denied_403() {
        let transport = MockTransport::response(Ok(HttpResponse {
            status: 403,
            headers: Default::default(),
            body: "permission denied".to_string(),
        }));
        let adapter = ManagementApiAdapter::new("sbp_test".to_string(), transport);

        let error = adapter.list_projects().await.expect_err("403 should fail");

        assert_eq!(error.code, DbEditorErrorCode::PermissionDenied);
        assert_eq!(error.status, Some(403));
    }

    #[tokio::test]
    async fn maps_rate_limit_and_retry_after() {
        let transport = MockTransport::response(Ok(HttpResponse {
            status: 429,
            headers: [("retry-after".to_string(), "17".to_string())]
                .into_iter()
                .collect(),
            body: String::new(),
        }));
        let adapter = ManagementApiAdapter::new("sbp_test".to_string(), transport);

        let error = adapter.list_projects().await.expect_err("429 should fail");

        assert_eq!(error.code, DbEditorErrorCode::RateLimited);
        assert_eq!(error.retry_after_seconds, Some(17));
    }

    #[tokio::test]
    async fn maps_transport_timeout() {
        let transport = MockTransport::response(Err(TransportError::timeout()));
        let adapter = ManagementApiAdapter::new("sbp_test".to_string(), transport);

        let error = adapter
            .list_projects()
            .await
            .expect_err("timeout should fail");

        assert_eq!(error.code, DbEditorErrorCode::Timeout);
    }

    #[test]
    fn query_response_accepts_array_and_result_envelope() {
        assert_eq!(
            extract_query_rows("[{\"id\":1}]").expect("array"),
            vec![serde_json::json!({"id": 1})]
        );
        assert_eq!(
            extract_query_rows("{\"result\":[{\"id\":1}]}").expect("result envelope"),
            vec![serde_json::json!({"id": 1})]
        );
    }

    #[tokio::test]
    async fn sends_mutations_to_write_endpoint_with_bound_parameters() {
        let transport = MockTransport::response(Ok(HttpResponse {
            status: 201,
            headers: Default::default(),
            body: "[{\"row\":{\"id\":1}}]".to_string(),
        }));
        let adapter = ManagementApiAdapter::new("sbp_test_secret".to_string(), transport.clone());

        let rows = adapter
            .run_mutation_query(
                "project-a",
                "UPDATE \"public\".\"records\" SET \"label\" = $1",
                vec![json!("new label")],
            )
            .await
            .expect("mutation query");

        assert_eq!(rows, vec![json!({"row": {"id": 1}})]);
        let request = transport
            .request
            .lock()
            .expect("request lock")
            .clone()
            .expect("request captured");
        assert_eq!(request.path, "/v1/projects/project-a/database/query");
        assert_eq!(
            request.body,
            Some(json!({
                "query": "UPDATE \"public\".\"records\" SET \"label\" = $1",
                "parameters": ["new label"],
                "read_only": false,
            }))
        );
        assert!(!format!("{request:?}").contains("sbp_test_secret"));
    }
}
