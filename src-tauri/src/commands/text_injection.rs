use crate::services::{clipboard_paste, direct_typing};
use tauri::AppHandle;

#[tauri::command]
pub async fn insert_text(
    text: String,
    insertion_mode: String,
    app_handle: AppHandle,
) -> Result<(), String> {
    match insertion_mode.as_str() {
        "typing" => direct_typing::inject_text_native(&text, &app_handle),
        "clipboard" | _ => clipboard_paste::insert_text_via_clipboard(&text, &app_handle),
    }
}

#[tauri::command]
pub async fn select_all_text(app_handle: AppHandle) -> Result<(), String> {
    direct_typing::send_key_combo_native("control", "a", &app_handle)
        .map_err(|e| format!("Failed to send Ctrl+A: {}", e))
}

#[tauri::command]
pub async fn copy_selected_text(app_handle: AppHandle) -> Result<String, String> {
    clipboard_paste::copy_selected_text(&app_handle)
}

#[tauri::command]
pub async fn clear_clipboard(app_handle: AppHandle) -> Result<(), String> {
    use tauri_plugin_clipboard_manager::ClipboardExt;
    app_handle.clipboard()
        .write_text("")
        .map_err(|e| format!("Failed to clear clipboard: {}", e))
}
