use tauri::{AppHandle, Manager};

pub const PROJECT_WORKSPACE_WINDOW_LABEL: &str = "project-workspace";

#[tauri::command]
pub async fn open_project_workspace_window(
    window: tauri::WebviewWindow,
    app: AppHandle,
) -> Result<(), String> {
    if window.label() != "main" {
        return Err("Project Workspace 창은 메인 창에서만 열 수 있습니다.".to_string());
    }

    #[cfg(desktop)]
    {
        tauri::async_runtime::spawn_blocking(move || {
            if let Some(workspace) = app.get_webview_window(PROJECT_WORKSPACE_WINDOW_LABEL) {
                let _ = workspace.unminimize();
                let _ = workspace.show();
                let _ = workspace.set_focus();
                return Ok(());
            }

            tauri::WebviewWindowBuilder::new(
                &app,
                PROJECT_WORKSPACE_WINDOW_LABEL,
                tauri::WebviewUrl::App("index.html".into()),
            )
            .title("Personal OS — Project Workspace")
            .inner_size(1000.0, 750.0)
            .min_inner_size(720.0, 520.0)
            .resizable(true)
            .build()
            .map(|_| ())
            .map_err(|error| format!("Project Workspace 창을 열지 못했습니다: {error}"))
        })
        .await
        .map_err(|error| format!("Project Workspace 창을 열지 못했습니다: {error}"))?
    }

    #[cfg(not(desktop))]
    {
        let _ = app;
        Err("Project Workspace는 데스크톱에서만 사용할 수 있습니다.".to_string())
    }
}

#[cfg(test)]
mod tests {
    use super::PROJECT_WORKSPACE_WINDOW_LABEL;

    #[test]
    fn keeps_a_single_reusable_window_label() {
        assert_eq!(PROJECT_WORKSPACE_WINDOW_LABEL, "project-workspace");
    }
}
