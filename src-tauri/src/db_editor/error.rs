use serde::Serialize;
use std::fmt;

/// Error codes exposed to the DB Editor UI. Messages intentionally contain no
/// request body, response body, or credential value.
#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub enum DbEditorErrorCode {
    PatMissing,
    InvalidPat,
    PermissionDenied,
    RateLimited,
    Timeout,
    Network,
    CredentialStore,
    InvalidIdentifier,
    BlockedSchema,
    TableNotFound,
    InvalidPage,
    InvalidResponse,
    QueryFailed,
    NativeWindow,
    #[allow(dead_code)]
    Unsupported,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DbEditorError {
    pub code: DbEditorErrorCode,
    pub message: String,
    pub status: Option<u16>,
    pub retry_after_seconds: Option<u64>,
}

impl DbEditorError {
    pub fn new(code: DbEditorErrorCode, message: impl Into<String>) -> Self {
        Self {
            code,
            message: message.into(),
            status: None,
            retry_after_seconds: None,
        }
    }

    pub fn with_status(mut self, status: u16) -> Self {
        self.status = Some(status);
        self
    }

    pub fn with_retry_after(mut self, retry_after_seconds: Option<u64>) -> Self {
        self.retry_after_seconds = retry_after_seconds;
        self
    }
}

impl fmt::Display for DbEditorError {
    fn fmt(&self, formatter: &mut fmt::Formatter<'_>) -> fmt::Result {
        formatter.write_str(&self.message)
    }
}

impl std::error::Error for DbEditorError {}

/// Keep the redaction rule testable and reusable at every sensitive boundary.
#[allow(dead_code)]
pub fn redact_secret(message: &str, secret: &str) -> String {
    if secret.is_empty() {
        return message.to_string();
    }

    message.replace(secret, "[REDACTED]")
}

/// A credential value that cannot accidentally appear in Debug/Display output.
#[derive(Clone, PartialEq, Eq)]
pub struct SecretString(String);

impl SecretString {
    pub fn new(value: impl Into<String>) -> Self {
        Self(value.into())
    }

    pub fn expose(&self) -> &str {
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

#[cfg(test)]
mod tests {
    use super::{redact_secret, SecretString};

    #[test]
    fn secret_is_redacted_from_debug_and_messages() {
        let secret = "sbp_test_secret_123";
        let wrapped = SecretString::new(secret);

        assert_eq!(format!("{wrapped:?}"), "[REDACTED]");
        assert_eq!(format!("{wrapped}"), "[REDACTED]");
        assert_eq!(
            redact_secret(&format!("request failed with {secret}"), secret),
            "request failed with [REDACTED]"
        );
    }
}
