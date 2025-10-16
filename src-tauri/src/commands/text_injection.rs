use crate::services::{clipboard_paste, direct_typing};
use tauri::AppHandle;

#[tauri::command]
pub async fn insert_text(
    text: String,
    insertion_mode: String,
    app_handle: AppHandle,
) -> Result<(), String> {
    match insertion_mode.as_str() {
        "typing" => direct_typing::inject_text_native(&text),
        "clipboard" | _ => clipboard_paste::insert_text_via_clipboard(&text, &app_handle),
    }
}

#[tauri::command]
pub async fn copy_selected_text(app_handle: AppHandle) -> Result<String, String> {
    clipboard_paste::copy_selected_text(&app_handle)
}
