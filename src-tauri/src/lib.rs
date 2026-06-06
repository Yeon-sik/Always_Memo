use std::{collections::HashMap, env, fs, path::PathBuf};

#[cfg(desktop)]
use tauri::{
    menu::{Menu, MenuItem},
    tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent},
};
use tauri::{AppHandle, Manager};

#[derive(serde::Serialize)]
#[serde(rename_all = "camelCase")]
struct RuntimeConfig {
    supabase_url: String,
    supabase_anon_key: String,
    user_id: String,
    loaded: bool,
    source_path: Option<String>,
}

fn normalize_env_value(value: &str) -> String {
    let trimmed = value.trim();

    if trimmed.len() >= 2 {
        let first = trimmed.as_bytes()[0];
        let last = trimmed.as_bytes()[trimmed.len() - 1];

        if (first == b'"' && last == b'"') || (first == b'\'' && last == b'\'') {
            return trimmed[1..trimmed.len() - 1].to_string();
        }
    }

    trimmed.to_string()
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
                values.insert(key.to_string(), normalize_env_value(value));
            }
        }
    }

    values
}

fn first_env_value(values: &HashMap<String, String>, keys: &[&str]) -> String {
    keys.iter()
        .find_map(|key| values.get(*key))
        .map(|value| value.trim().to_string())
        .filter(|value| !value.is_empty())
        .unwrap_or_default()
}

fn runtime_env_candidates(app: &AppHandle) -> Vec<PathBuf> {
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

fn config_from_values(
    values: HashMap<String, String>,
    source_path: Option<String>,
) -> RuntimeConfig {
    RuntimeConfig {
        supabase_url: first_env_value(&values, &["SUPABASE_URL", "VITE_SUPABASE_URL"]),
        supabase_anon_key: first_env_value(
            &values,
            &["SUPABASE_ANON_KEY", "VITE_SUPABASE_ANON_KEY"],
        ),
        user_id: first_env_value(&values, &["USER_ID", "VITE_USER_ID"]),
        loaded: source_path.is_some(),
        source_path,
    }
}

#[tauri::command]
fn load_runtime_config(app: AppHandle) -> RuntimeConfig {
    for candidate in runtime_env_candidates(&app) {
        if !candidate.is_file() {
            continue;
        }

        if let Ok(contents) = fs::read_to_string(&candidate) {
            return config_from_values(
                parse_env(&contents),
                Some(candidate.to_string_lossy().to_string()),
            );
        }
    }

    config_from_values(HashMap::new(), None)
}

// 트레이 메뉴나 아이콘 클릭 시 숨겨진 메인 창을 다시 앞으로 가져온다.
#[cfg(desktop)]
fn show_main_window(app: &tauri::AppHandle) {
    if let Some(window) = app.get_webview_window("main") {
        let _ = window.unminimize();
        let _ = window.show();
        let _ = window.set_focus();
    }
}

// 창을 종료하지 않고 트레이에 남기기 위해 메인 창만 숨긴다.
#[cfg(desktop)]
fn hide_main_window(app: &tauri::AppHandle) {
    if let Some(window) = app.get_webview_window("main") {
        let _ = window.hide();
    }
}

#[cfg(desktop)]
// Windows 데스크톱 앱에서 사용할 트레이 메뉴와 좌클릭 동작을 구성한다.
fn setup_tray(app: &mut tauri::App) -> tauri::Result<()> {
    let show_item = MenuItem::with_id(app, "show", "열기", true, None::<&str>)?;
    let hide_item = MenuItem::with_id(app, "hide", "숨기기", true, None::<&str>)?;
    let quit_item = MenuItem::with_id(app, "quit", "종료", true, None::<&str>)?;
    let menu = Menu::with_items(app, &[&show_item, &hide_item, &quit_item])?;

    let mut tray_builder = TrayIconBuilder::new()
        .tooltip("Yeonsik's Note")
        .menu(&menu)
        .show_menu_on_left_click(false)
        .on_menu_event(|app, event| match event.id().as_ref() {
            "show" => show_main_window(app),
            "hide" => hide_main_window(app),
            "quit" => app.exit(0),
            _ => {}
        })
        .on_tray_icon_event(|tray, event| {
            if let TrayIconEvent::Click {
                button: MouseButton::Left,
                button_state: MouseButtonState::Up,
                ..
            } = event
            {
                show_main_window(tray.app_handle());
            }
        });

    if let Some(icon) = app.default_window_icon() {
        tray_builder = tray_builder.icon(icon.clone());
    }

    tray_builder.build(app)?;

    Ok(())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    // Tauri 런타임 진입점: opener/autostart 플러그인, tray, 닫기 동작을 연결한다.
    let builder = tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .invoke_handler(tauri::generate_handler![load_runtime_config])
        .setup(|_app| {
            #[cfg(desktop)]
            {
                use tauri_plugin_autostart::MacosLauncher;

                _app.handle().plugin(tauri_plugin_autostart::init(
                    MacosLauncher::LaunchAgent,
                    None::<Vec<&str>>,
                ))?;
                setup_tray(_app)?;
            }

            Ok(())
        });

    #[cfg(desktop)]
    let builder = builder.on_window_event(|window, event| {
        if let tauri::WindowEvent::CloseRequested { api, .. } = event {
            api.prevent_close();
            let _ = window.hide();
        }
    });

    builder
        .run(tauri::generate_context!())
        .expect("error while running Yeonsik's Note");
}
