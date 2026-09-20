use std::fs;
use std::path::{Path, PathBuf};
use std::time::{SystemTime, UNIX_EPOCH};

use tauri::{AppHandle, Manager};
use tauri_plugin_opener::OpenerExt;

const CONFIG_FILE_NAME: &str = "knowledge-vault.json";

#[derive(Clone, Debug, serde::Serialize, serde::Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct KnowledgeVaultConfig {
    pub vault_path: Option<String>,
}

#[derive(Clone, Debug, serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct KnowledgeVaultOperationResult {
    pub status: String,
    pub relative_path: String,
}

#[derive(Debug, serde::Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct UpdateKnowledgeDocumentRequest {
    pub current_relative_path: String,
    pub next_relative_path: String,
    pub id: String,
    pub title: String,
    #[serde(rename = "type")]
    pub document_type: String,
    pub project_id: Option<String>,
    pub workstream_id: Option<String>,
    pub created_at: String,
}

fn config_path(app: &AppHandle) -> Result<PathBuf, String> {
    app.path()
        .app_config_dir()
        .map(|directory| directory.join(CONFIG_FILE_NAME))
        .map_err(|error| format!("Knowledge Vault config directory is unavailable: {error}"))
}

fn normalize_vault_path(path: &str) -> Result<PathBuf, String> {
    let trimmed = path.trim();
    if trimmed.is_empty() {
        return Err("Knowledge Vault 경로를 입력하세요.".to_string());
    }

    let candidate = PathBuf::from(trimmed);
    if !candidate.is_absolute() {
        return Err("Knowledge Vault 경로는 absolute path여야 합니다.".to_string());
    }
    if !candidate.is_dir() {
        return Err("Knowledge Vault 경로가 존재하는 폴더가 아닙니다.".to_string());
    }

    fs::canonicalize(&candidate)
        .map_err(|error| format!("Knowledge Vault 경로를 검증하지 못했습니다: {error}"))
}

fn load_config(app: &AppHandle) -> Result<KnowledgeVaultConfig, String> {
    let path = config_path(app)?;
    if !path.is_file() {
        return Ok(KnowledgeVaultConfig { vault_path: None });
    }

    let contents = fs::read_to_string(path)
        .map_err(|error| format!("Knowledge Vault 설정을 읽지 못했습니다: {error}"))?;
    let mut config = serde_json::from_str::<KnowledgeVaultConfig>(&contents)
        .map_err(|error| format!("Knowledge Vault 설정 형식이 올바르지 않습니다: {error}"))?;
    if let Some(path) = config.vault_path.as_deref() {
        config.vault_path = Some(
            normalize_vault_path(path)
                .map_err(|error| format!("저장된 Knowledge Vault를 사용할 수 없습니다: {error}"))?
                .to_string_lossy()
                .to_string(),
        );
    }
    Ok(config)
}

fn configured_vault(app: &AppHandle) -> Result<PathBuf, String> {
    let config = load_config(app)?;
    let path = config
        .vault_path
        .ok_or_else(|| "Knowledge Vault 경로를 먼저 설정하세요.".to_string())?;
    normalize_vault_path(&path)
}

fn is_reserved_windows_name(segment: &str) -> bool {
    let stem = segment
        .split('.')
        .next()
        .unwrap_or_default()
        .to_ascii_uppercase();
    matches!(stem.as_str(), "CON" | "PRN" | "AUX" | "NUL")
        || ((stem.starts_with("COM") || stem.starts_with("LPT"))
            && stem.len() == 4
            && stem.as_bytes()[3].is_ascii_digit()
            && stem.as_bytes()[3] != b'0')
}

fn validate_relative_path(relative_path: &str) -> Result<PathBuf, String> {
    let normalized = relative_path.replace('\\', "/");
    if normalized.trim().is_empty()
        || normalized.starts_with('/')
        || normalized.starts_with("//")
        || normalized.as_bytes().get(1) == Some(&b':')
    {
        return Err("Vault-relative path만 허용됩니다.".to_string());
    }

    let mut safe_path = PathBuf::new();
    for segment in normalized.split('/') {
        if segment.is_empty() || segment == "." || segment == ".." {
            return Err("Vault path traversal 또는 빈 path segment가 차단되었습니다.".to_string());
        }
        if segment.chars().any(|character| {
            character.is_control() || matches!(character, '<' | '>' | ':' | '"' | '|' | '?' | '*')
        }) {
            return Err("Windows에서 허용되지 않는 문자가 path에 포함되어 있습니다.".to_string());
        }
        if segment.ends_with('.') || segment.ends_with(' ') || is_reserved_windows_name(segment) {
            return Err(
                "Windows reserved name 또는 trailing dot/space가 차단되었습니다.".to_string(),
            );
        }
        safe_path.push(segment);
    }

    Ok(safe_path)
}

fn target_path(vault: &Path, relative_path: &str, create_parent: bool) -> Result<PathBuf, String> {
    let relative = validate_relative_path(relative_path)?;
    let vault = fs::canonicalize(vault)
        .map_err(|error| format!("Knowledge Vault root를 확인하지 못했습니다: {error}"))?;
    let target = vault.join(relative);
    let parent = target
        .parent()
        .ok_or_else(|| "Vault target parent가 없습니다.".to_string())?;

    if create_parent {
        fs::create_dir_all(parent)
            .map_err(|error| format!("Knowledge Vault 폴더를 만들지 못했습니다: {error}"))?;
    }
    let canonical_parent = fs::canonicalize(parent)
        .map_err(|error| format!("Knowledge Vault target parent를 확인하지 못했습니다: {error}"))?;
    if !canonical_parent.starts_with(&vault) {
        return Err("Vault 외부 경로가 차단되었습니다.".to_string());
    }
    Ok(target)
}

fn atomic_write(path: &Path, contents: &str) -> Result<bool, String> {
    if let Ok(existing) = fs::read_to_string(path) {
        if existing == contents {
            return Ok(false);
        }
    }

    let stamp = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|duration| duration.as_nanos())
        .unwrap_or_default();
    let file_name = path
        .file_name()
        .and_then(|value| value.to_str())
        .unwrap_or("document.md");
    let temporary = path.with_file_name(format!(".{file_name}.{stamp}.tmp"));
    fs::write(&temporary, contents)
        .map_err(|error| format!("Knowledge Vault temporary write failed: {error}"))?;

    match fs::rename(&temporary, path) {
        Ok(()) => Ok(true),
        Err(rename_error) if path.exists() => {
            fs::remove_file(path)
                .map_err(|error| format!("Knowledge Vault target replace failed: {error}"))?;
            fs::rename(&temporary, path).map_err(|error| {
                format!(
                    "Knowledge Vault atomic rename failed after replace ({rename_error}): {error}"
                )
            })?;
            Ok(true)
        }
        Err(error) => {
            let _ = fs::remove_file(&temporary);
            Err(format!("Knowledge Vault atomic rename failed: {error}"))
        }
    }
}

fn percent_encode_uri_component(value: &str) -> String {
    value
        .as_bytes()
        .iter()
        .map(|byte| {
            if byte.is_ascii_alphanumeric() || matches!(byte, b'-' | b'_' | b'.' | b'~' | b'/') {
                (*byte as char).to_string()
            } else {
                format!("%{byte:02X}")
            }
        })
        .collect()
}

fn yaml_string(value: &str) -> String {
    serde_json::to_string(value).unwrap_or_else(|_| "\"\"".to_string())
}

fn managed_frontmatter(request: &UpdateKnowledgeDocumentRequest) -> Result<String, String> {
    let document_type = request.document_type.to_ascii_uppercase();
    if !matches!(
        document_type.as_str(),
        "IDEA" | "PLAN" | "DESIGN" | "RESEARCH" | "NOTE"
    ) {
        return Err("KnowledgeDocument type가 올바르지 않습니다.".to_string());
    }

    if request.project_id.is_some() && request.workstream_id.is_some() {
        return Err(
            "KnowledgeDocument는 Project와 Workstream을 동시에 소유할 수 없습니다.".to_string(),
        );
    }

    Ok([
        "---".to_string(),
        format!("id: {}", yaml_string(&request.id)),
        format!("type: {}", document_type.to_ascii_lowercase()),
        "managed_by: personal-os".to_string(),
        "schema_version: 1".to_string(),
        format!("title: {}", yaml_string(&request.title)),
        format!(
            "project_id: {}",
            request
                .project_id
                .as_deref()
                .map(yaml_string)
                .unwrap_or_else(|| "null".to_string())
        ),
        format!(
            "workstream_id: {}",
            request
                .workstream_id
                .as_deref()
                .map(yaml_string)
                .unwrap_or_else(|| "null".to_string())
        ),
        format!("created_at: {}", yaml_string(&request.created_at)),
        "---".to_string(),
    ]
    .join("\n"))
}

fn replace_managed_frontmatter(contents: &str, frontmatter: &str) -> String {
    let mut offset = 0usize;
    let mut line_index = 0usize;
    let mut closing_end = None;

    for line in contents.split_inclusive('\n') {
        let without_newline = line.trim_end_matches(['\r', '\n']);
        if line_index > 0 && without_newline == "---" {
            closing_end = Some(offset + line.len());
            break;
        }
        offset += line.len();
        line_index += 1;
    }

    if contents.lines().next().map(str::trim) == Some("---") {
        if let Some(end) = closing_end {
            return format!("{frontmatter}\n{}", &contents[end..]);
        }
    }

    format!("{frontmatter}\n\n{contents}")
}

#[tauri::command]
pub fn knowledge_vault_get_config(app: AppHandle) -> Result<KnowledgeVaultConfig, String> {
    load_config(&app)
}

#[tauri::command]
pub fn knowledge_vault_set_path(
    app: AppHandle,
    path: String,
) -> Result<KnowledgeVaultConfig, String> {
    let normalized = normalize_vault_path(&path)?;
    let config = KnowledgeVaultConfig {
        vault_path: Some(normalized.to_string_lossy().to_string()),
    };
    let path = config_path(&app)?;
    let parent = path
        .parent()
        .ok_or_else(|| "Knowledge Vault config parent is unavailable.".to_string())?;
    fs::create_dir_all(parent)
        .map_err(|error| format!("Knowledge Vault config directory creation failed: {error}"))?;
    let contents = serde_json::to_string_pretty(&config)
        .map_err(|error| format!("Knowledge Vault config serialization failed: {error}"))?;
    atomic_write(&path, &contents)?;
    Ok(config)
}

#[tauri::command]
pub fn knowledge_vault_create_document(
    app: AppHandle,
    relative_path: String,
    contents: String,
) -> Result<KnowledgeVaultOperationResult, String> {
    let vault = configured_vault(&app)?;
    let target = target_path(&vault, &relative_path, true)?;
    if target.exists() {
        return Ok(KnowledgeVaultOperationResult {
            status: "conflict".to_string(),
            relative_path,
        });
    }
    atomic_write(&target, &contents)?;
    Ok(KnowledgeVaultOperationResult {
        status: "created".to_string(),
        relative_path,
    })
}

#[tauri::command]
pub fn knowledge_vault_write_generated_file(
    app: AppHandle,
    relative_path: String,
    contents: String,
) -> Result<KnowledgeVaultOperationResult, String> {
    let vault = configured_vault(&app)?;
    let target = target_path(&vault, &relative_path, true)?;
    let changed = atomic_write(&target, &contents)?;
    Ok(KnowledgeVaultOperationResult {
        status: if changed { "updated" } else { "unchanged" }.to_string(),
        relative_path,
    })
}

#[tauri::command]
pub fn knowledge_vault_update_document(
    app: AppHandle,
    request: UpdateKnowledgeDocumentRequest,
) -> Result<KnowledgeVaultOperationResult, String> {
    let vault = configured_vault(&app)?;
    let source = target_path(&vault, &request.current_relative_path, false)?;
    let target = target_path(&vault, &request.next_relative_path, true)?;
    if !source.is_file() {
        return Ok(KnowledgeVaultOperationResult {
            status: "missing".to_string(),
            relative_path: request.next_relative_path,
        });
    }
    if source != target && target.exists() {
        return Ok(KnowledgeVaultOperationResult {
            status: "conflict".to_string(),
            relative_path: request.next_relative_path,
        });
    }

    let contents = fs::read_to_string(&source)
        .map_err(|error| format!("Knowledge document read failed: {error}"))?;
    let frontmatter = managed_frontmatter(&request)?;
    let next_contents = replace_managed_frontmatter(&contents, &frontmatter);
    if source == target {
        let changed = atomic_write(&target, &next_contents)?;
        return Ok(KnowledgeVaultOperationResult {
            status: if changed { "updated" } else { "unchanged" }.to_string(),
            relative_path: request.next_relative_path,
        });
    }

    atomic_write(&target, &next_contents)?;
    fs::remove_file(&source)
        .map_err(|error| format!("Knowledge document source move cleanup failed: {error}"))?;
    Ok(KnowledgeVaultOperationResult {
        status: "updated".to_string(),
        relative_path: request.next_relative_path,
    })
}

#[tauri::command]
pub fn knowledge_vault_move_file(
    app: AppHandle,
    current_relative_path: String,
    next_relative_path: String,
) -> Result<KnowledgeVaultOperationResult, String> {
    let vault = configured_vault(&app)?;
    let source = target_path(&vault, &current_relative_path, false)?;
    let target = target_path(&vault, &next_relative_path, true)?;
    if !source.is_file() {
        return Ok(KnowledgeVaultOperationResult {
            status: "missing".to_string(),
            relative_path: next_relative_path,
        });
    }
    if source == target {
        return Ok(KnowledgeVaultOperationResult {
            status: "unchanged".to_string(),
            relative_path: next_relative_path,
        });
    }
    if target.exists() {
        return Ok(KnowledgeVaultOperationResult {
            status: "conflict".to_string(),
            relative_path: next_relative_path,
        });
    }
    fs::rename(&source, &target)
        .map_err(|error| format!("Knowledge Vault file move failed: {error}"))?;
    Ok(KnowledgeVaultOperationResult {
        status: "updated".to_string(),
        relative_path: next_relative_path,
    })
}

#[tauri::command]
pub fn knowledge_vault_open_file(app: AppHandle, relative_path: String) -> Result<(), String> {
    let vault = configured_vault(&app)?;
    let target = target_path(&vault, &relative_path, false)?;
    if !target.is_file() {
        return Err("Knowledge document 파일이 아직 없습니다.".to_string());
    }
    let absolute_path = target.to_string_lossy().to_string();
    let obsidian_uri = format!(
        "obsidian://open?path={}",
        percent_encode_uri_component(&absolute_path)
    );
    if app.opener().open_url(obsidian_uri, None::<&str>).is_ok() {
        return Ok(());
    }

    app.opener()
        .open_path(absolute_path, None::<&str>)
        .map_err(|error| format!("Knowledge document를 열지 못했습니다: {error}"))
}

#[cfg(test)]
mod tests {
    use super::validate_relative_path;

    #[test]
    fn rejects_absolute_and_traversal_paths() {
        assert!(validate_relative_path("C:/outside.md").is_err());
        assert!(validate_relative_path("../outside.md").is_err());
        assert!(validate_relative_path("Projects/../outside.md").is_err());
    }

    #[test]
    fn rejects_windows_reserved_segments() {
        assert!(validate_relative_path("Projects/CON/Note.md").is_err());
        assert!(validate_relative_path("Projects/valid./Note.md").is_err());
    }

    #[test]
    fn accepts_safe_posix_style_paths() {
        assert!(validate_relative_path("Projects/개인 OS/Plans/계획.md").is_ok());
    }
}
