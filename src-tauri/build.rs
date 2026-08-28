fn main() {
    tauri_build::try_build(tauri_build::Attributes::new().app_manifest(
        tauri_build::AppManifest::new().commands(&[
            "load_runtime_config",
            "load_persisted_device",
            "save_persisted_device",
            "quick_capture_shortcut_status",
            "show_quick_capture",
            "db_editor_pat_status",
            "db_editor_save_pat",
            "db_editor_verify_pat",
            "db_editor_delete_pat",
            "db_editor_list_projects",
            "db_editor_list_schemas",
            "db_editor_list_tables",
            "db_editor_get_table_metadata",
            "db_editor_list_rows",
            "update_db_row",
            "open_db_editor_window",
        ]),
    ))
    .expect("failed to build Tauri application manifest");
}
