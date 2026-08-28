use super::error::{DbEditorError, DbEditorErrorCode};

const CREDENTIAL_SERVICE: &str = "com.yeonsik.note.db-editor";
const CREDENTIAL_USERNAME: &str = "supabase-management-pat";

pub trait CredentialBackend: Send + Sync {
    fn get(&self) -> Result<Option<String>, DbEditorError>;
    fn set(&self, value: &str) -> Result<(), DbEditorError>;
    fn delete(&self) -> Result<(), DbEditorError>;
}

/// Application-level credential abstraction. The native backend is the only
/// production implementation; tests inject a memory backend without touching
/// the user's operating-system credential store.
pub struct CredentialStore {
    backend: Box<dyn CredentialBackend>,
}

impl CredentialStore {
    pub fn native() -> Self {
        Self {
            backend: Box::new(NativeCredentialBackend),
        }
    }

    #[allow(dead_code)]
    pub fn from_backend<B>(backend: B) -> Self
    where
        B: CredentialBackend + 'static,
    {
        Self {
            backend: Box::new(backend),
        }
    }

    pub fn get_pat(&self) -> Result<Option<String>, DbEditorError> {
        self.backend.get()
    }

    pub fn has_pat(&self) -> Result<bool, DbEditorError> {
        Ok(self
            .backend
            .get()?
            .map(|value| !value.trim().is_empty())
            .unwrap_or(false))
    }

    pub fn save_pat(&self, pat: &str) -> Result<(), DbEditorError> {
        let normalized = pat.trim();

        if normalized.is_empty() || normalized.contains(['\r', '\n']) {
            return Err(DbEditorError::new(
                DbEditorErrorCode::InvalidPat,
                "Supabase PAT를 입력하세요.",
            ));
        }

        self.backend.set(normalized)
    }

    pub fn delete_pat(&self) -> Result<(), DbEditorError> {
        self.backend.delete()
    }
}

struct NativeCredentialBackend;

impl NativeCredentialBackend {
    fn entry(&self) -> Result<keyring::Entry, DbEditorError> {
        keyring::Entry::new(CREDENTIAL_SERVICE, CREDENTIAL_USERNAME).map_err(|_| {
            DbEditorError::new(
                DbEditorErrorCode::CredentialStore,
                "OS Credential Store를 사용할 수 없습니다.",
            )
        })
    }
}

impl CredentialBackend for NativeCredentialBackend {
    fn get(&self) -> Result<Option<String>, DbEditorError> {
        match self.entry()?.get_password() {
            Ok(value) => Ok(Some(value)),
            Err(keyring::Error::NoEntry) => Ok(None),
            Err(_) => Err(DbEditorError::new(
                DbEditorErrorCode::CredentialStore,
                "OS Credential Store에서 PAT를 읽지 못했습니다.",
            )),
        }
    }

    fn set(&self, value: &str) -> Result<(), DbEditorError> {
        self.entry()?.set_password(value).map_err(|_| {
            DbEditorError::new(
                DbEditorErrorCode::CredentialStore,
                "OS Credential Store에 PAT를 저장하지 못했습니다.",
            )
        })
    }

    fn delete(&self) -> Result<(), DbEditorError> {
        match self.entry()?.delete_credential() {
            Ok(()) | Err(keyring::Error::NoEntry) => Ok(()),
            Err(_) => Err(DbEditorError::new(
                DbEditorErrorCode::CredentialStore,
                "OS Credential Store에서 PAT를 삭제하지 못했습니다.",
            )),
        }
    }
}

#[cfg(test)]
mod tests {
    use super::{CredentialBackend, CredentialStore};
    use crate::db_editor::error::{DbEditorError, DbEditorErrorCode};
    use std::sync::{Arc, Mutex};

    #[derive(Clone, Default)]
    struct MemoryBackend {
        value: Arc<Mutex<Option<String>>>,
    }

    impl CredentialBackend for MemoryBackend {
        fn get(&self) -> Result<Option<String>, DbEditorError> {
            Ok(self.value.lock().expect("memory backend lock").clone())
        }

        fn set(&self, value: &str) -> Result<(), DbEditorError> {
            *self.value.lock().expect("memory backend lock") = Some(value.to_string());
            Ok(())
        }

        fn delete(&self) -> Result<(), DbEditorError> {
            *self.value.lock().expect("memory backend lock") = None;
            Ok(())
        }
    }

    #[test]
    fn credential_store_uses_backend_without_exposing_secret() {
        let store = CredentialStore::from_backend(MemoryBackend::default());

        store
            .save_pat("  sbp_test_secret  ")
            .expect("PAT should save");

        assert!(store.has_pat().expect("PAT status should load"));
        assert_eq!(
            store.get_pat().expect("PAT should load").as_deref(),
            Some("sbp_test_secret")
        );

        store.delete_pat().expect("PAT should delete");
        assert!(!store.has_pat().expect("PAT status should load"));
    }

    #[test]
    fn credential_store_rejects_empty_or_multiline_pat() {
        let store = CredentialStore::from_backend(MemoryBackend::default());

        for value in ["", "   ", "sbp_test\nsecret"] {
            let error = store.save_pat(value).expect_err("invalid PAT should fail");
            assert_eq!(error.code, DbEditorErrorCode::InvalidPat);
        }
    }
}
