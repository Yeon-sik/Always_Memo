mod credential_store;
mod database_crud_adapter;
mod error;
mod management_api_adapter;
mod metadata_adapter;
mod models;

use credential_store::CredentialStore;
use database_crud_adapter::{DatabaseCrudAdapter, DEFAULT_PAGE_SIZE};
use error::{DbEditorError, DbEditorErrorCode};
use management_api_adapter::{ManagementApiAdapter, ReqwestTransport};
use metadata_adapter::MetadataAdapter;
use models::{
    DbEditorPatStatus, DbEditorPatVerification, DbEditorProject, DbEditorRowsPage, DbEditorSchema,
    DbEditorTable, DbEditorTableMetadata,
};
use tauri::{AppHandle, Manager};

pub const DB_EDITOR_WINDOW_LABEL: &str = "db-editor";
pub const MAIN_WINDOW_LABEL: &str = "main";

pub fn authorize_db_editor_window(label: &str) -> Result<(), DbEditorError> {
    authorize_window_label(label, DB_EDITOR_WINDOW_LABEL)
}

pub fn authorize_main_window(label: &str) -> Result<(), DbEditorError> {
    authorize_window_label(label, MAIN_WINDOW_LABEL)
}

fn authorize_window_label(label: &str, expected: &str) -> Result<(), DbEditorError> {
    if label == expected {
        return Ok(());
    }

    Err(DbEditorError::new(
        DbEditorErrorCode::PermissionDenied,
        "이 창에서는 DB Editor 명령을 호출할 수 없습니다.",
    ))
}

fn require_db_editor_window(window: &tauri::WebviewWindow) -> Result<(), DbEditorError> {
    authorize_db_editor_window(window.label())
}

fn stored_pat() -> Result<String, DbEditorError> {
    CredentialStore::native().get_pat()?.ok_or_else(|| {
        DbEditorError::new(
            DbEditorErrorCode::PatMissing,
            "먼저 Supabase PAT를 저장하세요.",
        )
    })
}

fn credential_store() -> CredentialStore {
    CredentialStore::native()
}

fn management_api(pat: String) -> Result<ManagementApiAdapter<ReqwestTransport>, DbEditorError> {
    let transport = ReqwestTransport::new()?;
    Ok(ManagementApiAdapter::new(pat, transport))
}

fn metadata_api(pat: String) -> Result<MetadataAdapter<ReqwestTransport>, DbEditorError> {
    Ok(MetadataAdapter::new(management_api(pat)?))
}

#[tauri::command]
pub fn db_editor_pat_status(
    window: tauri::WebviewWindow,
) -> Result<DbEditorPatStatus, DbEditorError> {
    require_db_editor_window(&window)?;
    Ok(DbEditorPatStatus {
        configured: credential_store().has_pat()?,
    })
}

#[tauri::command]
pub fn db_editor_save_pat(
    window: tauri::WebviewWindow,
    pat: String,
) -> Result<DbEditorPatStatus, DbEditorError> {
    require_db_editor_window(&window)?;
    credential_store().save_pat(&pat)?;
    Ok(DbEditorPatStatus { configured: true })
}

#[tauri::command]
pub async fn db_editor_verify_pat(
    window: tauri::WebviewWindow,
) -> Result<DbEditorPatVerification, DbEditorError> {
    require_db_editor_window(&window)?;
    let projects = management_api(stored_pat()?)?.list_projects().await?;

    Ok(DbEditorPatVerification {
        valid: true,
        project_count: projects.len(),
    })
}

#[tauri::command]
pub fn db_editor_delete_pat(
    window: tauri::WebviewWindow,
) -> Result<DbEditorPatStatus, DbEditorError> {
    require_db_editor_window(&window)?;
    credential_store().delete_pat()?;
    Ok(DbEditorPatStatus { configured: false })
}

#[tauri::command(rename_all = "camelCase")]
pub async fn db_editor_list_projects(
    window: tauri::WebviewWindow,
) -> Result<Vec<DbEditorProject>, DbEditorError> {
    require_db_editor_window(&window)?;
    management_api(stored_pat()?)?.list_projects().await
}

#[tauri::command(rename_all = "camelCase")]
pub async fn db_editor_list_schemas(
    window: tauri::WebviewWindow,
    project_ref: String,
) -> Result<Vec<DbEditorSchema>, DbEditorError> {
    require_db_editor_window(&window)?;
    metadata_api(stored_pat()?)?
        .list_schemas(&project_ref)
        .await
}

#[tauri::command(rename_all = "camelCase")]
pub async fn db_editor_list_tables(
    window: tauri::WebviewWindow,
    project_ref: String,
    schema: String,
) -> Result<Vec<DbEditorTable>, DbEditorError> {
    require_db_editor_window(&window)?;
    metadata_api(stored_pat()?)?
        .list_tables(&project_ref, &schema)
        .await
}

#[tauri::command(rename_all = "camelCase")]
pub async fn db_editor_get_table_metadata(
    window: tauri::WebviewWindow,
    project_ref: String,
    schema: String,
    table: String,
) -> Result<DbEditorTableMetadata, DbEditorError> {
    require_db_editor_window(&window)?;
    metadata_api(stored_pat()?)?
        .get_table_metadata(&project_ref, &schema, &table)
        .await
}

#[tauri::command(rename_all = "camelCase")]
pub async fn db_editor_list_rows(
    window: tauri::WebviewWindow,
    project_ref: String,
    schema: String,
    table: String,
    page: u32,
    page_size: Option<u32>,
) -> Result<DbEditorRowsPage, DbEditorError> {
    require_db_editor_window(&window)?;
    let page_size = page_size.unwrap_or(DEFAULT_PAGE_SIZE);
    let pat = stored_pat()?;
    let transport = ReqwestTransport::new()?;
    let metadata = MetadataAdapter::new(ManagementApiAdapter::new(pat.clone(), transport.clone()))
        .get_table_metadata(&project_ref, &schema, &table)
        .await?;
    let adapter = DatabaseCrudAdapter::new(ManagementApiAdapter::new(pat, transport));

    adapter
        .select_page(&project_ref, &metadata, page, page_size)
        .await
}

#[tauri::command]
pub fn open_db_editor_window(
    window: tauri::WebviewWindow,
    app: AppHandle,
) -> Result<(), DbEditorError> {
    authorize_main_window(window.label())?;

    #[cfg(desktop)]
    {
        if let Some(window) = app.get_webview_window(DB_EDITOR_WINDOW_LABEL) {
            let _ = window.unminimize();
            let _ = window.show();
            let _ = window.set_focus();
            return Ok(());
        }

        tauri::WebviewWindowBuilder::new(
            &app,
            DB_EDITOR_WINDOW_LABEL,
            tauri::WebviewUrl::App("index.html".into()),
        )
        .title("Personal OS — Supabase DB Editor")
        .inner_size(1400.0, 900.0)
        .min_inner_size(960.0, 640.0)
        .resizable(true)
        .build()
        .map(|_| ())
        .map_err(|_| {
            DbEditorError::new(
                DbEditorErrorCode::NativeWindow,
                "DB Editor 창을 열지 못했습니다.",
            )
        })
    }

    #[cfg(not(desktop))]
    {
        let _ = app;
        Err(DbEditorError::new(
            DbEditorErrorCode::Unsupported,
            "DB Editor는 데스크톱에서만 사용할 수 있습니다.",
        ))
    }
}

#[cfg(test)]
mod tests {
    use super::{authorize_db_editor_window, authorize_main_window};
    use crate::db_editor::error::DbEditorErrorCode;

    #[test]
    fn blocks_privileged_commands_from_main_window() {
        let error = authorize_db_editor_window("main").expect_err("main must be denied");

        assert_eq!(error.code, DbEditorErrorCode::PermissionDenied);
    }

    #[test]
    fn allows_privileged_commands_from_db_editor_window() {
        authorize_db_editor_window("db-editor").expect("db-editor must be allowed");
    }

    #[test]
    fn only_main_window_can_open_db_editor() {
        authorize_main_window("main").expect("main must be allowed");
        assert!(authorize_main_window("db-editor").is_err());
    }
}
